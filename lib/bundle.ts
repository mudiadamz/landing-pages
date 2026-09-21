import { createAdminClient } from "@/lib/db/admin";

/**
 * Bundles grant their contents as ordinary purchases. Doing it this way means
 * every existing ownership check — the download route, the panel list, the EPUB
 * reader gate — keeps working untouched, because a bundled item looks exactly
 * like a bought one.
 */

/** Product ids a bundle contains, or [] when the product isn't a bundle. */
export async function getBundleItemIds(bundleProductId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_landing_pages")
    .select("bundle_product_ids")
    .eq("id", bundleProductId)
    .maybeSingle();
  const ids = (data?.bundle_product_ids ?? []) as string[] | null;
  if (!ids?.length) return [];
  // A bundle containing itself would grant nothing new and risks a loop.
  return [...new Set(ids)].filter((id) => id && id !== bundleProductId);
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
  const { error } = await admin.from("lp_purchases").upsert(
    itemIds.map((id) => ({
      user_id: userId,
      landing_page_id: id,
      amount: 0,
      payment_method: "bundle",
      invoice_number: null,
      bundle_parent_id: bundleProductId,
    })),
    { onConflict: "user_id,landing_page_id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("grantBundleItems error:", error);
    return 0;
  }
  return itemIds.length;
}
