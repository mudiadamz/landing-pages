/**
 * Whether a product is in its "upcoming" (scheduled, not-yet-released) window
 * for a given viewer. Before `availableAt` a non-owner sees only a countdown and
 * cannot read/buy; the owner always sees it (so they can preview + verify). NULL
 * `availableAt` means available immediately.
 *
 * Plain module (not a server action) so it can be shared by server components,
 * client components, route handlers, and server actions alike.
 */
export function isUpcoming(
  availableAt: string | null | undefined,
  viewerIsOwner: boolean,
): boolean {
  if (!availableAt || viewerIsOwner) return false;
  return new Date(availableAt).getTime() > Date.now();
}
