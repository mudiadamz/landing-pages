"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "./profiles";

/**
 * Admin control over who still has access to what they bought.
 *
 * Revoking sets lp_purchases.revoked_at, and the RLS policy on that table does
 * the rest: the buyer's own client stops seeing the row, so the reader, the ZIP
 * download, the PDF/EPUB routes and the post-checkout screen all refuse at once
 * (see the 20260729010000 migration).
 *
 * Nothing here deletes. The row keeps its invoice number, amount and payment
 * method, and still counts toward the product's sold_count — revoking access is
 * a support decision and must not quietly rewrite what was sold. If a revoke is
 * meant to be a refund, that is a separate act.
 *
 * Full admin only, not the delegated "stats" feature: someone trusted to read
 * the numbers is not thereby trusted to take a paid product away.
 */

export type CustomerPurchase = {
  id: string;
  landing_page_id: string;
  title: string;
  slug: string;
  purchased_at: string;
  amount: number;
  payment_method: string | null;
  invoice_number: string | null;
  /** Granted as part of a bundle rather than bought on its own. */
  bundle_parent_id: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
};

/** Everything one customer owns, revoked included — service role, so RLS doesn't hide it. */
export async function getCustomerPurchases(userId: string): Promise<CustomerPurchase[]> {
  if (!(await requireAdmin()) || !userId) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lp_purchases")
    .select(
      "id, landing_page_id, purchased_at, amount, payment_method, invoice_number, bundle_parent_id, revoked_at, revoke_reason",
    )
    .eq("user_id", userId)
    .order("purchased_at", { ascending: false });

  if (error || !data?.length) return [];

  const pageIds = [...new Set(data.map((r) => r.landing_page_id))];
  const { data: pages } = await admin
    .from("lp_landing_pages")
    .select("id, title, slug")
    .in("id", pageIds);
  const byId = new Map((pages ?? []).map((p) => [p.id, p]));

  return data.map((r) => {
    const page = byId.get(r.landing_page_id);
    return {
      id: r.id,
      landing_page_id: r.landing_page_id,
      title: page?.title ?? "(produk terhapus)",
      slug: page?.slug ?? "",
      purchased_at: r.purchased_at,
      amount: r.amount ?? 0,
      payment_method: r.payment_method ?? null,
      invoice_number: r.invoice_number ?? null,
      bundle_parent_id: r.bundle_parent_id ?? null,
      revoked_at: r.revoked_at ?? null,
      revoke_reason: r.revoke_reason ?? null,
    };
  });
}

export type RevokeResult = { ok: boolean; error?: string };

export async function setPurchaseRevoked(
  purchaseId: string,
  revoked: boolean,
  reason?: string,
): Promise<RevokeResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Tidak diizinkan." };
  if (!purchaseId) return { ok: false, error: "Pembelian tidak ditemukan." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin
    .from("lp_purchases")
    .update(
      revoked
        ? {
            revoked_at: new Date().toISOString(),
            revoked_by: user?.id ?? null,
            revoke_reason: reason?.trim() || null,
          }
        : { revoked_at: null, revoked_by: null, revoke_reason: null },
    )
    .eq("id", purchaseId);

  if (error) {
    console.error("setPurchaseRevoked error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }

  // The buyer's library and reader are per-request, but the panel lists aren't.
  revalidatePath("/panel/sales");
  revalidatePath("/panel/purchases");
  return { ok: true };
}
