"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { getProfile, requireFeature } from "./profiles";
import {
  nextFulfillmentStatuses,
  normalizeFulfillment,
  type FulfillmentStatus,
} from "@/lib/product-type";

/**
 * Moving an order along: pending → processing → done, or cancelled.
 *
 * Exists because a catalog that sells goods and services has a state a digital
 * one never had. A digital purchase is finished by the event that creates it;
 * everything else leaves the seller holding work, and work that nothing tracks
 * is work that gets forgotten.
 *
 * What this does NOT do, deliberately:
 *
 *  - It does not touch access. `revoked_at` is the access decision and this is
 *    not it — cancelling an order the buyer already has files for would be a
 *    refund, which is a separate act with its own ledger entry.
 *  - It does not reopen a finished order. `nextFulfillmentStatuses` is the whole
 *    rule, and it lives in the pure module so the panel can grey out exactly the
 *    options this will refuse.
 *
 * Authorization mirrors lib/actions/sales.ts rather than inventing a second
 * answer: whoever can see a sale can move it. That means the product's owner,
 * or anyone the business has delegated the sales feature to. Written through
 * the service role because a seller is not the buyer on lp_purchases, so RLS
 * would hide their own order from them.
 */

export type FulfillmentResult = { ok: boolean; error?: string };

export async function setPurchaseFulfillment(
  purchaseId: string,
  status: FulfillmentStatus,
  note?: string,
): Promise<FulfillmentResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Tidak diizinkan." };
  if (!purchaseId) return { ok: false, error: "Pesanan tidak ditemukan." };

  const admin = createAdminClient();
  const { data: purchase } = await admin
    .from("lp_purchases")
    .select("id, landing_page_id, fulfillment_status")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { ok: false, error: "Pesanan tidak ditemukan." };

  const { data: product } = await admin
    .from("lp_landing_pages")
    .select("user_id")
    .eq("id", purchase.landing_page_id)
    .maybeSingle();

  const ownsProduct = !!product && product.user_id === profile.id;
  if (!ownsProduct && !(await requireFeature("stats"))) {
    return { ok: false, error: "Tidak diizinkan." };
  }

  const current = normalizeFulfillment(purchase.fulfillment_status);
  if (!nextFulfillmentStatuses(current).includes(status)) {
    return { ok: false, error: "Perubahan status itu tidak diizinkan." };
  }

  const { error } = await admin
    .from("lp_purchases")
    .update({
      fulfillment_status: status,
      fulfillment_note: note?.trim() || null,
      // Stamped only when the order actually completes. A cancelled order has
      // no fulfilment time, and writing one would make the column a lie the
      // next report reads as a delivery.
      fulfilled_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", purchaseId);

  if (error) {
    console.error("setPurchaseFulfillment error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }

  revalidatePath("/panel/sales");
  revalidatePath("/panel/purchases");
  return { ok: true };
}
