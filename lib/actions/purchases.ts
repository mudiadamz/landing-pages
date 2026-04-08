"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateInvoiceNumber } from "@/lib/invoice";

export type PurchaseWithPage = {
  id: string;
  landing_page_id: string;
  purchased_at: string;
  title: string;
  slug: string;
  zip_url?: string | null;
};

export async function getPurchasesForUser(): Promise<PurchaseWithPage[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("purchases")
    .select(`
      id,
      landing_page_id,
      purchased_at,
      landing_pages (title, slug, zip_url)
    `)
    .eq("user_id", user.id)
    .order("purchased_at", { ascending: false });

  if (error) return [];

  type Row = {
    id: string;
    landing_page_id: string;
    purchased_at: string;
    landing_pages:
      | { title: string; slug: string; zip_url?: string | null }
      | { title: string; slug: string; zip_url?: string | null }[]
      | null;
  };

  return (data ?? []).map((p: Row) => {
    const lp = Array.isArray(p.landing_pages) ? p.landing_pages[0] : p.landing_pages;
    return {
      id: p.id,
      landing_page_id: p.landing_page_id,
      purchased_at: p.purchased_at,
      title: lp?.title ?? "Unknown",
      slug: lp?.slug ?? "",
      zip_url: lp?.zip_url ?? null,
    };
  });
}

export async function addPurchase(landingPageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("purchases").insert({
    user_id: user.id,
    landing_page_id: landingPageId,
    amount: 0,
    payment_method: "free",
    invoice_number: generateInvoiceNumber(),
  });

  if (error) {
    if (error.code === "23505") {
      redirect("/panel");
      return;
    }
    throw error;
  }

  revalidatePath("/panel");
  revalidatePath("/");
  redirect("/panel");
}

export async function addPurchaseAction(formData: FormData) {
  const id = formData.get("landing_page_id") as string;
  if (id) await addPurchase(id);
}

export type InvoiceRow = {
  id: string;
  invoice_number: string | null;
  purchased_at: string;
  amount: number;
  payment_method: string | null;
  title: string;
  slug: string;
};

export async function getInvoicesForUser(): Promise<InvoiceRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("purchases")
    .select(`
      id,
      invoice_number,
      purchased_at,
      amount,
      payment_method,
      landing_pages (title, slug)
    `)
    .eq("user_id", user.id)
    .order("purchased_at", { ascending: false });

  if (error) return [];

  type Row = {
    id: string;
    invoice_number: string | null;
    purchased_at: string;
    amount: number;
    payment_method: string | null;
    landing_pages:
      | { title: string; slug: string }
      | { title: string; slug: string }[]
      | null;
  };

  return (data ?? []).map((p: Row) => {
    const lp = Array.isArray(p.landing_pages) ? p.landing_pages[0] : p.landing_pages;
    return {
      id: p.id,
      invoice_number: p.invoice_number,
      purchased_at: p.purchased_at,
      amount: p.amount ?? 0,
      payment_method: p.payment_method,
      title: lp?.title ?? "Unknown",
      slug: lp?.slug ?? "",
    };
  });
}

export async function getInvoiceById(id: string): Promise<(InvoiceRow & { user_name: string; user_email: string }) | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("purchases")
    .select(`
      id,
      invoice_number,
      purchased_at,
      amount,
      payment_method,
      landing_pages (title, slug)
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  const lp = Array.isArray(data.landing_pages) ? data.landing_pages[0] : data.landing_pages;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  return {
    id: data.id,
    invoice_number: data.invoice_number,
    purchased_at: data.purchased_at,
    amount: data.amount ?? 0,
    payment_method: data.payment_method,
    title: lp?.title ?? "Unknown",
    slug: lp?.slug ?? "",
    user_name: profile?.full_name ?? user.email ?? "",
    user_email: profile?.email ?? user.email ?? "",
  };
}
