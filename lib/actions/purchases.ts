"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateInvoiceNumber } from "@/lib/invoice";
import { isUpcoming } from "@/lib/product-status";
import { grantBundleItems } from "@/lib/bundle";

export type PurchaseWithPage = {
  id: string;
  landing_page_id: string;
  purchased_at: string;
  title: string;
  slug: string;
  zip_url?: string | null;
  story_pdf_url?: string | null;
  story_epub_url?: string | null;
  thumbnail_url?: string | null;
  /** Set when this item came from a bundle rather than a direct purchase. */
  bundle_parent_id?: string | null;
  bundle_parent_title?: string | null;
};

export async function getPurchasesForUser(): Promise<PurchaseWithPage[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lp_purchases")
    .select(`
      id,
      landing_page_id,
      purchased_at,
      bundle_parent_id,
      landing_pages:lp_landing_pages!purchases_landing_page_id_fkey (title, slug, zip_url, story_pdf_url, story_epub_url, thumbnail_url)
    `)
    .eq("user_id", user.id)
    .order("purchased_at", { ascending: false });

  if (error) return [];

  type LP = { title: string; slug: string; zip_url?: string | null; story_pdf_url?: string | null; story_epub_url?: string | null; thumbnail_url?: string | null };
  type Row = {
    id: string;
    landing_page_id: string;
    purchased_at: string;
    bundle_parent_id: string | null;
    landing_pages: LP | LP[] | null;
  };

  // Bundle titles are looked up separately: lp_purchases now has two foreign
  // keys into lp_landing_pages, and a second embed would need a constraint-name
  // hint that survived the table rename with its old name.
  const rows = (data ?? []) as Row[];
  const parentIds = [...new Set(rows.map((r) => r.bundle_parent_id).filter(Boolean) as string[])];
  const parentTitles = new Map<string, string>();
  if (parentIds.length) {
    const { data: parents } = await supabase
      .from("lp_landing_pages")
      .select("id, title")
      .in("id", parentIds);
    for (const p of (parents ?? []) as { id: string; title: string }[]) {
      parentTitles.set(p.id, p.title);
    }
  }

  return rows.map((p: Row) => {
    const lp = Array.isArray(p.landing_pages) ? p.landing_pages[0] : p.landing_pages;
    return {
      id: p.id,
      landing_page_id: p.landing_page_id,
      purchased_at: p.purchased_at,
      title: lp?.title ?? "Unknown",
      slug: lp?.slug ?? "",
      zip_url: lp?.zip_url ?? null,
      story_pdf_url: lp?.story_pdf_url ?? null,
      story_epub_url: lp?.story_epub_url ?? null,
      thumbnail_url: lp?.thumbnail_url ?? null,
      bundle_parent_id: p.bundle_parent_id ?? null,
      bundle_parent_title: p.bundle_parent_id ? parentTitles.get(p.bundle_parent_id) ?? null : null,
    };
  });
}

export async function addPurchase(landingPageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Block claiming a product that's still in its scheduled-upcoming window
  // (defense in depth — the UI already hides the button for non-owners).
  const { data: gate } = await supabase
    .from("lp_landing_pages")
    .select("available_at, user_id")
    .eq("id", landingPageId)
    .single();
  if (isUpcoming(gate?.available_at, gate?.user_id === user.id)) {
    throw new Error("Produk ini belum tersedia.");
  }

  const { error } = await supabase.from("lp_purchases").insert({
    user_id: user.id,
    landing_page_id: landingPageId,
    amount: 0,
    payment_method: "free",
    invoice_number: generateInvoiceNumber(),
  });

  // A free bundle still hands over everything inside it.
  if (!error) await grantBundleItems(user.id, landingPageId);

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
    .from("lp_purchases")
    .select(`
      id,
      invoice_number,
      purchased_at,
      amount,
      payment_method,
      landing_pages:lp_landing_pages (title, slug)
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
    .from("lp_purchases")
    .select(`
      id,
      invoice_number,
      purchased_at,
      amount,
      payment_method,
      landing_pages:lp_landing_pages (title, slug)
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  const lp = Array.isArray(data.landing_pages) ? data.landing_pages[0] : data.landing_pages;

  const { data: profile } = await supabase
    .from("lp_profiles")
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
