"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireFeature, getProfile } from "./profiles";

export type Stats = {
  totalLandingPages: number;
  totalPurchases: number;
  /** Of those, how many an admin has taken access back on. */
  totalRevoked: number;
  totalCustomers: number;
};

export type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  /** Everything they own, revoked included — this is their buying history. */
  purchase_count: number;
  /** How many of those an admin has since taken access to. */
  revoked_count: number;
  last_purchase_at: string | null;
};

export async function getStats(): Promise<Stats | null> {
  const isAdmin = await requireFeature("stats");
  if (!isAdmin) return null;

  const supabase = createAdminClient();

  const [pagesRes, purchasesRes, revokedRes, buyersRes] = await Promise.all([
    supabase.from("lp_landing_pages").select("id", { count: "exact", head: true }),
    supabase.from("lp_purchases").select("id", { count: "exact", head: true }),
    supabase
      .from("lp_purchases")
      .select("id", { count: "exact", head: true })
      .not("revoked_at", "is", null),
    supabase.from("lp_purchases").select("user_id"),
  ]);

  const uniqueBuyers = new Set((buyersRes.data ?? []).map((r) => r.user_id));

  return {
    totalLandingPages: pagesRes.count ?? 0,
    totalPurchases: purchasesRes.count ?? 0,
    totalRevoked: revokedRes.count ?? 0,
    totalCustomers: uniqueBuyers.size,
  };
}

export async function getCustomers(): Promise<CustomerRow[]> {
  const isAdmin = await requireFeature("stats");
  if (!isAdmin) return [];

  const supabase = createAdminClient();

  // Service role, so revoked rows are included — the point is to surface them.
  const { data: purchases } = await supabase
    .from("lp_purchases")
    .select("user_id, purchased_at, revoked_at")
    .order("purchased_at", { ascending: false });

  if (!purchases?.length) return [];

  const countMap = new Map<string, number>();
  const revokedMap = new Map<string, number>();
  const lastPurchaseMap = new Map<string, string>();

  purchases.forEach((p) => {
    countMap.set(p.user_id, (countMap.get(p.user_id) ?? 0) + 1);
    if (p.revoked_at) revokedMap.set(p.user_id, (revokedMap.get(p.user_id) ?? 0) + 1);
    if (!lastPurchaseMap.has(p.user_id)) lastPurchaseMap.set(p.user_id, p.purchased_at);
  });

  const buyerIds = [...countMap.keys()];
  const { data: profiles } = await supabase
    .from("lp_profiles")
    .select("id, full_name, email, role")
    .in("id", buyerIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return buyerIds.map((uid) => {
    const p = profileMap.get(uid);
    return {
      id: uid,
      full_name: p?.full_name ?? null,
      email: p?.email ?? null,
      role: p?.role ?? "customer",
      purchase_count: countMap.get(uid) ?? 0,
      revoked_count: revokedMap.get(uid) ?? 0,
      last_purchase_at: lastPurchaseMap.get(uid) ?? null,
    };
  });
}

export type ProductStatRow = {
  id: string;
  title: string;
  sold: number;
  revenue: number;
  /** Of `sold`, how many have had access revoked. */
  revoked: number;
};
export type PublisherStats = {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  /** Of `totalSales`, how many are revoked. */
  totalRevoked: number;
  products: ProductStatRow[];
};

/**
 * Sales stats scoped to the current seller's OWN products (by user_id). Used by
 * the publisher stats view. Reads via the service-role client because a seller
 * isn't the buyer on lp_purchases, so RLS would hide their products' sales.
 *
 * `sold` and `revenue` deliberately COUNT revoked rows: revoking is an access
 * decision, not a refund — the money was still taken. But a bare "19 terjual"
 * when 17 have been revoked reads as a much healthier catalog than it is, so the
 * revoked share is reported alongside and surfaced in red, the same way the
 * site-wide purchases card does it.
 */
export async function getMyProductStats(): Promise<PublisherStats | null> {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "publisher")) return null;

  const supabase = createAdminClient();
  const { data: pages } = await supabase
    .from("lp_landing_pages")
    .select("id, title")
    .eq("user_id", profile.id);
  const products = pages ?? [];
  const ids = products.map((p) => p.id);

  const agg = new Map<string, { sold: number; revenue: number; revoked: number }>();
  if (ids.length) {
    const { data: purchases } = await supabase
      .from("lp_purchases")
      .select("landing_page_id, amount, revoked_at")
      .in("landing_page_id", ids);
    for (const p of purchases ?? []) {
      const cur = agg.get(p.landing_page_id) ?? { sold: 0, revenue: 0, revoked: 0 };
      cur.sold += 1;
      cur.revenue += Number(p.amount ?? 0);
      if (p.revoked_at) cur.revoked += 1;
      agg.set(p.landing_page_id, cur);
    }
  }

  const rows: ProductStatRow[] = products
    .map((p) => {
      const a = agg.get(p.id) ?? { sold: 0, revenue: 0, revoked: 0 };
      return { id: p.id, title: p.title, sold: a.sold, revenue: a.revenue, revoked: a.revoked };
    })
    .sort((a, b) => b.sold - a.sold);

  return {
    totalProducts: products.length,
    totalSales: rows.reduce((s, r) => s + r.sold, 0),
    totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
    totalRevoked: rows.reduce((s, r) => s + r.revoked, 0),
    products: rows,
  };
}

export type PublisherApplication = {
  id: string;
  full_name: string | null;
  email: string | null;
  publisher_applied_at: string | null;
  /** Short-lived signed URLs for the identity photos; null if never submitted. */
  ktp_url: string | null;
  selfie_url: string | null;
};

/** How long a KYC photo link stays valid — long enough to review, not to keep. */
const KYC_URL_TTL_SECONDS = 10 * 60;

/**
 * Pending publisher applications, oldest first — for the admin review screen.
 *
 * The identity photos live in a private bucket with no storage policies at all,
 * so they are reachable only through signed URLs minted here, behind the same
 * admin check as the rest of the row. Applications submitted before the KYC
 * step existed simply have no photos.
 */
export async function getPublisherApplications(): Promise<PublisherApplication[]> {
  const isAdmin = await requireFeature("users");
  if (!isAdmin) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lp_profiles")
    .select("id, full_name, email, publisher_applied_at, publisher_ktp_path, publisher_selfie_path")
    .eq("publisher_status", "pending")
    .order("publisher_applied_at", { ascending: true });

  if (error) return [];

  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data: signed } = await supabase.storage
      .from("publisher-kyc")
      .createSignedUrl(path, KYC_URL_TTL_SECONDS);
    return signed?.signedUrl ?? null;
  };

  return Promise.all(
    (data ?? []).map(async (r) => ({
      id: r.id,
      full_name: r.full_name ?? null,
      email: r.email ?? null,
      publisher_applied_at: r.publisher_applied_at ?? null,
      ktp_url: await sign(r.publisher_ktp_path ?? null),
      selfie_url: await sign(r.publisher_selfie_path ?? null),
    })),
  );
}

/** Approve an application: promote the user to publisher. */
export async function approvePublisher(userId: string): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireFeature("users");
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };
  if (!userId) return { ok: false, error: "User tidak valid." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lp_profiles")
    .update({
      role: "publisher",
      publisher_status: "approved",
      publisher_reviewed_at: new Date().toISOString(),
      publisher_reviewed_by: (await getProfile())?.id ?? null,
      publisher_reject_note: null,
    })
    .eq("id", userId)
    .eq("publisher_status", "pending");

  if (error) {
    console.error("approvePublisher error:", error);
    return { ok: false, error: "Gagal menyetujui." };
  }
  revalidatePath("/panel/users");
  return { ok: true };
}

/** Reject an application: keep the user a customer, mark as rejected. */
export async function rejectPublisher(
  userId: string,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireFeature("users");
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };
  if (!userId) return { ok: false, error: "User tidak valid." };

  const supabase = createAdminClient();
  const reviewer = await getProfile();

  const { data: row, error } = await supabase
    .from("lp_profiles")
    .update({
      publisher_status: "rejected",
      publisher_reviewed_at: new Date().toISOString(),
      publisher_reviewed_by: reviewer?.id ?? null,
      publisher_reject_note: note?.trim().slice(0, 500) || null,
    })
    .eq("id", userId)
    .eq("publisher_status", "pending")
    .select("publisher_ktp_path, publisher_selfie_path")
    .maybeSingle();

  if (error) {
    console.error("rejectPublisher error:", error);
    return { ok: false, error: "Gagal menolak." };
  }

  // Drop the ID photos on rejection. They were collected to answer one question,
  // that question has been answered, and keeping a stranger's KTP on a decision
  // that went against them is a liability with no upside — a re-application
  // takes fresh photos anyway. Approvals keep theirs as the record of the check.
  const paths = [row?.publisher_ktp_path, row?.publisher_selfie_path].filter(
    Boolean,
  ) as string[];
  if (paths.length) {
    const { error: rmErr } = await supabase.storage.from("publisher-kyc").remove(paths);
    if (rmErr) console.error("rejectPublisher photo cleanup error:", rmErr);
    else {
      await supabase
        .from("lp_profiles")
        .update({ publisher_ktp_path: null, publisher_selfie_path: null })
        .eq("id", userId);
    }
  }

  revalidatePath("/panel/users");
  revalidatePath("/panel/profile");
  return { ok: true };
}
