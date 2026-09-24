import { createAdminClient } from "@/lib/db/admin";
import { initialFulfillment, normalizeProductType } from "@/lib/product-type";

/**
 * Bundles grant their contents as ordinary purchases. Doing it this way means
 * every existing ownership check — the download route, the panel list, the EPUB
 * reader gate — keeps working untouched, because a bundled item looks exactly
 * like a bought one.
 */

/**
 * Product ids a bundle contains, or [] when the product isn't a bundle.
 *
 * Items outside the bundle's own business are dropped. The write path already
 * refuses to store them (scopeProductRefs in lib/actions/landing-pages.ts), but
 * this is the side that hands out ownership: a stale row written before that
 * check existed must not turn into a free purchase of someone else's product.
 * A bundle whose business_id is null is a single-business deployment — nothing
 * to scope to, so every listed item stands.
 */
export async function getBundleItemIds(bundleProductId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_landing_pages")
    .select("bundle_product_ids, business_id")
    .eq("id", bundleProductId)
    .maybeSingle();
  const ids = (data?.bundle_product_ids ?? []) as string[] | null;
  if (!ids?.length) return [];
  // A bundle containing itself would grant nothing new and risks a loop.
  const unique = [...new Set(ids)].filter((id) => id && id !== bundleProductId);
  if (unique.length === 0) return [];

  const businessId = (data?.business_id as string | null) ?? null;
  if (!businessId) return unique;

  const { data: items } = await admin
    .from("lp_landing_pages")
    .select("id")
    .in("id", unique)
    .eq("business_id", businessId);
  const sameBusiness = new Set((items ?? []).map((r) => r.id as string));
  return unique.filter((id) => sameBusiness.has(id));
}

/**
 * Grant every product inside a bundle to the buyer. Safe to call more than once
 * (a callback can be retried, and the buyer may already own some parts):
 * ignoreDuplicates leans on the unique(user_id, landing_page_id) constraint.
 *
 * Child rows carry no invoice number — the bundle's own purchase holds it, and
 * the invoice index is partial so nulls don't collide.
 */
export async function grantBundleItems(
  userId: string,
  bundleProductId: string,
): Promise<number> {
  const itemIds = await getBundleItemIds(bundleProductId);
  if (itemIds.length === 0) return 0;

  const admin = createAdminClient();
  // Each item starts where its OWN kind says it should: a bundle of three
  // ebooks grants three finished rows, while a bundle that includes a printed
  // copy leaves that one waiting to be sent. Reading the bundle's type once and
  // applying it to every child would be the bug this loop exists to avoid.
  const { data: kinds } = await admin
    .from("lp_landing_pages")
    .select("id, product_type")
    .in("id", itemIds);
  const typeById = new Map(
    (kinds ?? []).map((r) => [r.id as string, normalizeProductType(r.product_type)]),
  );
  const now = new Date().toISOString();

  const { error } = await admin.from("lp_purchases").upsert(
    itemIds.map((id) => {
      const status = initialFulfillment(typeById.get(id) ?? "digital");
      return {
        user_id: userId,
        landing_page_id: id,
        amount: 0,
        payment_method: "bundle",
        invoice_number: null,
        bundle_parent_id: bundleProductId,
        fulfillment_status: status,
        fulfilled_at: status === "done" ? now : null,
      };
    }),
    { onConflict: "user_id,landing_page_id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("grantBundleItems error:", error);
    return 0;
  }
  return itemIds.length;
}
