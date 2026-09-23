"use server";

import { revalidatePath } from "next/cache";
import { editingSite } from "@/lib/site-resolve";
import { canSellOnSite } from "@/lib/site-membership";
import { createAdminClient } from "@/lib/db/admin";
import { requireFeature, getProfile, currentSiteStanding } from "./profiles";

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
  /** Everything they own, revoked included — this is their buying history. */
  purchase_count: number;
  /** How many of those an admin has since taken access to. */
  revoked_count: number;
  last_purchase_at: string | null;
};

export async function getStats(): Promise<Stats | null> {
  const isAdmin = await requireFeature("stats");
  if (!isAdmin) return null;

  const db = createAdminClient();

  const [pagesRes, purchasesRes, revokedRes, buyersRes] = await Promise.all([
    db.from("lp_landing_pages").select("id", { count: "exact", head: true }),
    db.from("lp_purchases").select("id", { count: "exact", head: true }),
    db
      .from("lp_purchases")
      .select("id", { count: "exact", head: true })
      .not("revoked_at", "is", null),
    db.from("lp_purchases").select("user_id"),
  ]);

  // Deleted accounts leave their purchases behind with a NULL user_id. Counting
  // those would report every deleted buyer as one shared customer.
  const uniqueBuyers = new Set(
    (buyersRes.data ?? []).map((r) => r.user_id).filter((id): id is string => !!id),
  );

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

  const db = createAdminClient();

  // Service role, so revoked rows are included — the point is to surface them.
  const { data: purchases } = await db
    .from("lp_purchases")
    .select("user_id, purchased_at, revoked_at")
    .order("purchased_at", { ascending: false });

  if (!purchases?.length) return [];

  const countMap = new Map<string, number>();
  const revokedMap = new Map<string, number>();
  const lastPurchaseMap = new Map<string, string>();

  purchases.forEach((p) => {
    // A sale whose buyer was deleted has no customer row to show — it still
    // counts as revenue in getStats, but this list is people.
    if (!p.user_id) return;
    countMap.set(p.user_id, (countMap.get(p.user_id) ?? 0) + 1);
    if (p.revoked_at) revokedMap.set(p.user_id, (revokedMap.get(p.user_id) ?? 0) + 1);
    if (!lastPurchaseMap.has(p.user_id)) lastPurchaseMap.set(p.user_id, p.purchased_at);
  });

  const buyerIds = [...countMap.keys()];
  // lp_profiles, not lp_site_members: names and emails live on the person,
  // and lp_site_members has none of these columns. The wrong table used to
  // make this query fail — silently, since the error is not read — and every
  // customer rendered nameless.
  const { data: profiles } = await db
    .from("lp_profiles")
    .select("id, full_name, email")
    .in("id", buyerIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return buyerIds.map((uid) => {
    const p = profileMap.get(uid);
    return {
      id: uid,
      full_name: p?.full_name ?? null,
      email: p?.email ?? null,
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
export type MyProductStats = {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  /** Of `totalSales`, how many are revoked. */
  totalRevoked: number;
  products: ProductStatRow[];
};

/**
 * Sales stats scoped to the current seller's OWN products (by user_id). Used by
 * the seller's own stats view. Reads via the service-role client because a seller
 * isn't the buyer on lp_purchases, so RLS would hide their products' sales.
 *
 * `sold` and `revenue` deliberately COUNT revoked rows: revoking is an access
 * decision, not a refund — the money was still taken. But a bare "19 terjual"
 * when 17 have been revoked reads as a much healthier catalog than it is, so the
 * revoked share is reported alongside and surfaced in red, the same way the
 * site-wide purchases card does it.
 */
export async function getMyProductStats(): Promise<MyProductStats | null> {
  const profile = await getProfile();
  // Platform & anggota business; angkanya selalu produk miliknya sendiri.
  const standing = await currentSiteStanding();
  if (!profile || !canSellOnSite(standing)) return null;

  const db = createAdminClient();
  const { data: pages } = await db
    .from("lp_landing_pages")
    .select("id, title")
    .eq("user_id", profile.id);
  const products = pages ?? [];
  const ids = products.map((p) => p.id);

  const agg = new Map<string, { sold: number; revenue: number; revoked: number }>();
  if (ids.length) {
    const { data: purchases } = await db
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

/*
 * The publisher review desk used to live here: pending applications, approve,
 * reject, and the KTP/selfie cleanup that went with a rejection.
 *
 * Gone with the four-role rework. Nobody is promoted to seller on a storefront
 * any more — they register a Business, which has its own KYC and approval queue
 * at /panel/platform. The identity photos and the `publisher-kyc` bucket went
 * with it: holding a stranger's ID for a flow that no longer exists is personal
 * data kept for no reason.
 */
