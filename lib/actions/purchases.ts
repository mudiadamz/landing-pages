"use server";

import { revalidatePath } from "next/cache";
import { ensureSiteMembership } from "@/lib/actions/profiles";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { generateInvoiceNumber } from "@/lib/invoice";
import { isFreeProduct, isUpcoming } from "@/lib/product-status";
import { grantBundleItems } from "@/lib/bundle";
import { currentSiteId } from "@/lib/site-resolve";

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
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];

  const { data, error } = await db
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
    const { data: parents } = await db
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
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  // Block claiming a product that's still in its scheduled-upcoming window
  // (defense in depth — the UI already hides the button for non-owners).
  const { data: gate } = await db
    .from("lp_landing_pages")
    .select("available_at, user_id, is_free, price, price_discount")
    .eq("id", landingPageId)
    .single();
  if (!gate) throw new Error("Produk tidak ditemukan.");
  if (isUpcoming(gate.available_at, gate.user_id === user.id)) {
    throw new Error("Produk ini belum tersedia.");
  }
  // This action is a public POST endpoint: its argument is whatever the caller
  // sends, not what the "Ambil gratis" button was rendered for. Without this, a
  // replay with a paid product's id granted it for free. The INSERT policy on
  // lp_purchases refuses the same thing (20260919020000); this is the readable
  // error in front of it.
  if (!isFreeProduct(gate)) {
    throw new Error("Produk ini berbayar — selesaikan pembayaran di halaman checkout.");
  }

  const { error } = await db.from("lp_purchases").insert({
    user_id: user.id,
    landing_page_id: landingPageId,
    amount: 0,
    payment_method: "free",
    invoice_number: generateInvoiceNumber(),
    // Runs as a Server Action from the storefront, so the host is the right answer here.
    site_id: (await currentSiteId()) || null,
  });

  // A free bundle still hands over everything inside it.
  if (!error) await grantBundleItems(user.id, landingPageId);

  // Mengambil produk gratis pun menjadikan seseorang orang situs ini (fase 5).
  if (!error) await ensureSiteMembership(user.id, (await currentSiteId()) || "");

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
  /** Access was taken back by an admin; the payment still happened. */
  revoked_at: string | null;
};

/**
 * Read through the service role, scoped by hand to the caller's own id.
 *
 * The RLS policy hides revoked purchases so that no ownership check can forget
 * to — but a receipt is not access. Someone who paid keeps the record of having
 * paid, marked as revoked; making it vanish would just mean a support ticket
 * asking where it went.
 */
export async function getInvoicesForUser(): Promise<InvoiceRow[]> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];

  const { data, error } = await createAdminClient()
    .from("lp_purchases")
    .select(`
      id,
      invoice_number,
      purchased_at,
      amount,
      payment_method,
      revoked_at,
      landing_pages:lp_landing_pages!purchases_landing_page_id_fkey (title, slug)
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
    revoked_at: string | null;
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
      revoked_at: p.revoked_at ?? null,
    };
  });
}

export async function getInvoiceById(id: string): Promise<(InvoiceRow & { user_name: string; user_email: string }) | null> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  // Service role, scoped by hand to the caller — same reasoning as the list
  // above: the invoice for a revoked purchase must still open.
  const { data, error } = await createAdminClient()
    .from("lp_purchases")
    .select(`
      id,
      invoice_number,
      purchased_at,
      amount,
      payment_method,
      revoked_at,
      landing_pages:lp_landing_pages!purchases_landing_page_id_fkey (title, slug)
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  const lp = Array.isArray(data.landing_pages) ? data.landing_pages[0] : data.landing_pages;

  const { data: profile } = await db
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
    revoked_at: data.revoked_at ?? null,
    user_name: profile?.full_name ?? user.email ?? "",
    user_email: profile?.email ?? user.email ?? "",
  };
}
