/**
 * A short token that changes whenever a product's EPUB changes.
 *
 * The chapter endpoints are deliberately cached hard at the edge
 * (`s-maxage=86400`) — that caching is what fixed the seconds-of-blank-screen
 * problem, so it must stay. But the CDN keys on the request URL, and the URL
 * never mentioned which FILE it was serving. Rewriting the archive to a new
 * storage path therefore changed nothing the CDN could see: an edited chapter
 * kept serving the old text for up to a day.
 *
 * `revalidatePath` is not a fix for this. When a Route Handler sets its own
 * Cache-Control, the CDN entry belongs to that header, not to Next's cache —
 * measured directly: after an edit, `?cb=<random>` returned the new text while
 * the plain URL returned the old one with `x-vercel-cache: HIT`.
 *
 * So instead of trying to purge the cache, make the key move. Appending this
 * token to the chapter URL means a fresh archive is a fresh URL, and the old
 * entry simply ages out on its own.
 *
 * The value only has to change when the file does — every writer here uploads
 * to `<dir>/<Date.now()>-<name>.epub`, so that leading stamp is exactly the
 * signal. Anything unexpected falls back to a cheap string hash.
 */
export function epubVersionToken(sourceRef: string | null | undefined): string {
  if (!sourceRef) return "0";

  const base = sourceRef.split("?")[0].split("/").pop() ?? "";
  const stamp = base.match(/^(\d{10,})-/)?.[1];
  if (stamp) return stamp.slice(-9);

  // FNV-1a, enough to distinguish one path from another.
  let h = 0x811c9dc5;
  for (let i = 0; i < sourceRef.length; i++) {
    h ^= sourceRef.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Append the token as a query param, preserving any the URL already has. */
export function withEpubVersion(endpoint: string, token: string): string {
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}v=${encodeURIComponent(token)}`;
}
