"use server";

import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

  const [pagesRes, purchasesRes, buyersRes] = await Promise.all([
    supabase.from("landing_pages").select("id", { count: "exact", head: true }),
    supabase.from("purchases").select("id", { count: "exact", head: true }),
    supabase.from("purchases").select("user_id"),
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

  const supabase = await createClient();

  const { data: purchases } = await supabase
    .from("purchases")
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
    .from("profiles")
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
