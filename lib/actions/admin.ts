"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "./profiles";

export type Stats = {
  totalLandingPages: number;
  totalPurchases: number;
  totalCustomers: number;
};

export type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  purchase_count: number;
  last_purchase_at: string | null;
};

export async function getStats(): Promise<Stats | null> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return null;

  const supabase = createAdminClient();

  const [pagesRes, purchasesRes, buyersRes] = await Promise.all([
    supabase.from("lp_landing_pages").select("id", { count: "exact", head: true }),
    supabase.from("lp_purchases").select("id", { count: "exact", head: true }),
    supabase.from("lp_purchases").select("user_id"),
  ]);

  const uniqueBuyers = new Set((buyersRes.data ?? []).map((r) => r.user_id));

  return {
    totalLandingPages: pagesRes.count ?? 0,
    totalPurchases: purchasesRes.count ?? 0,
    totalCustomers: uniqueBuyers.size,
  };
}

export async function getCustomers(): Promise<CustomerRow[]> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return [];

  const supabase = createAdminClient();

  const { data: purchases } = await supabase
    .from("lp_purchases")
    .select("user_id, purchased_at")
    .order("purchased_at", { ascending: false });

  if (!purchases?.length) return [];

  const countMap = new Map<string, number>();
  const lastPurchaseMap = new Map<string, string>();

  purchases.forEach((p) => {
    countMap.set(p.user_id, (countMap.get(p.user_id) ?? 0) + 1);
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
      last_purchase_at: lastPurchaseMap.get(uid) ?? null,
    };
  });
}

async function requireAdmin() {
  const profile = await getProfile();
  return profile?.role === "admin";
}

export type PublisherApplication = {
  id: string;
  full_name: string | null;
  email: string | null;
  publisher_applied_at: string | null;
};

/** Pending publisher applications, newest first — for the admin review screen. */
export async function getPublisherApplications(): Promise<PublisherApplication[]> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lp_profiles")
    .select("id, full_name, email, publisher_applied_at")
    .eq("publisher_status", "pending")
    .order("publisher_applied_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as PublisherApplication[];
}

/** Approve an application: promote the user to publisher. */
export async function approvePublisher(userId: string): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };
  if (!userId) return { ok: false, error: "User tidak valid." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lp_profiles")
    .update({
      role: "publisher",
      publisher_status: "approved",
      publisher_reviewed_at: new Date().toISOString(),
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
export async function rejectPublisher(userId: string): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };
  if (!userId) return { ok: false, error: "User tidak valid." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lp_profiles")
    .update({
      publisher_status: "rejected",
      publisher_reviewed_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .eq("publisher_status", "pending");

  if (error) {
    console.error("rejectPublisher error:", error);
    return { ok: false, error: "Gagal menolak." };
  }
  revalidatePath("/panel/users");
  return { ok: true };
}
