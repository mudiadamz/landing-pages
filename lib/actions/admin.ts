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

  const [pagesRes, purchasesRes, customersRes] = await Promise.all([
    supabase.from("landing_pages").select("id", { count: "exact", head: true }),
    supabase.from("purchases").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
  ]);

  return {
    totalLandingPages: pagesRes.count ?? 0,
    totalPurchases: purchasesRes.count ?? 0,
    totalCustomers: customersRes.count ?? 0,
  };
}

export async function getCustomers(): Promise<CustomerRow[]> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return [];

  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("role", "customer")
    .order("id");

  if (!profiles?.length) return [];

  const { data: purchaseCounts } = await supabase
    .from("purchases")
    .select("user_id");

  const countMap = new Map<string, number>();
  const lastPurchaseMap = new Map<string, string>();

  const { data: purchaseDetails } = await supabase
    .from("purchases")
    .select("user_id, purchased_at")
    .order("purchased_at", { ascending: false });

  purchaseDetails?.forEach((p) => {
    countMap.set(p.user_id, (countMap.get(p.user_id) ?? 0) + 1);
    if (!lastPurchaseMap.has(p.user_id)) lastPurchaseMap.set(p.user_id, p.purchased_at);
  });

  return profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    role: p.role,
    purchase_count: countMap.get(p.id) ?? 0,
    last_purchase_at: lastPurchaseMap.get(p.id) ?? null,
  }));
}

async function requireAdmin() {
  const profile = await getProfile();
  return profile?.role === "admin" || !profile;
}
