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
