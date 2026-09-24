/**
 * Whether a product is in its "upcoming" (scheduled, not-yet-released) window
 * for a given viewer. Before `availableAt` a non-owner sees only a countdown and
 * cannot read/buy; the owner always sees it (so they can preview + verify). NULL
 * `availableAt` means available immediately.
 *
 * Plain module (not a server action) so it can be shared by server components,
 * client components, route handlers, and server actions alike.
 */
/**
 * Whether a product costs nothing — the one definition of "free".
 *
 * A product is free when it is flagged free, or when the price a buyer would
 * actually pay is zero or missing. A positive discount price IS the price, so
 * a product discounted to Rp10.000 is not free even if `price` were 0.
 *
 * The database holds the same rule in the INSERT policy on lp_purchases
 * (20260919020000), because that policy is what actually stops a paid product
 * being claimed through the "Ambil gratis" path. Change one, change both —
 * tests/product-free.test.ts and tests/db/rls-commerce.test.ts pin each side.
 */
export function isFreeProduct(p: {
  is_free?: boolean | null;
  price?: number | string | null;
  price_discount?: number | string | null;
}): boolean {
  if (p.is_free === true) return true;
  const discount = Number(p.price_discount ?? 0);
  if (discount > 0) return false;
  return Number(p.price ?? 0) <= 0;
}

export function isUpcoming(
  availableAt: string | null | undefined,
  viewerIsOwner: boolean,
): boolean {
  if (!availableAt || viewerIsOwner) return false;
  return new Date(availableAt).getTime() > Date.now();
}

/**
 * Out of stock — the one definition, asked of the row rather than of a count.
 *
 * Three states, and only the middle one is a refusal: `stock` NULL means the
 * seller is not tracking inventory (a made-to-order cake, a print-on-demand
 * shirt) and must never read as "none left"; 0 means none left; anything above
 * means available. Non-physical products are never sold out — a service does
 * not run out, it runs out of TIME, which this model does not claim to know.
 *
 * Checked at checkout, BEFORE money moves. The database trigger that decrements
 * stock deliberately clamps at zero instead of failing the insert, because
 * refusing the purchase row after Duitku has taken the payment would mean a
 * buyer who paid and received nothing (20260924010000).
 */
export function isSoldOut(p: {
  product_type?: string | null;
  stock?: number | string | null;
}): boolean {
  if (p.product_type !== "physical") return false;
  if (p.stock === null || p.stock === undefined || p.stock === "") return false;
  return Number(p.stock) <= 0;
}
