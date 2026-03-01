"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
