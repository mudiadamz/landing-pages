/**
 * A short token that changes whenever a product's EPUB changes.
 *
 * The chapter endpoints are deliberately cached hard (`max-age=300,
 * s-maxage=86400`) — that caching is what fixed the seconds-of-blank-screen
 * problem, so it must stay. But a cache keys on the request URL, and the URL
 * never mentioned which FILE it was serving. Rewriting the archive to a new
 * storage path therefore changed nothing the cache could see: an edited chapter
 * kept serving the old text.
 *
 * `revalidatePath` is not a fix for this. When a Route Handler sets its own
 * Cache-Control, the cached copy belongs to that header, not to Next's cache —
 * measured directly back when a CDN still fronted this app: after an edit,
 * `?cb=<random>` returned the new text while the plain URL returned the old one
 * from an upstream HIT. Serving from one's own server shortens the window to the
 * browser's `max-age` rather than closing it, and `s-maxage` is waiting for the
 * day a CDN is put back.
 *
 * So instead of trying to purge the cache, make the key move. Appending this
 * token to the chapter URL means a fresh archive is a fresh URL, and the old
 * entry simply ages out on its own.
 *
 * The value only has to change when the file does — every writer here uploads
 * to `<dir>/<Date.now()>-<name>.epub`, so that leading stamp is exactly the
 * signal. Anything unexpected falls back to a cheap string hash.
 */
function hash(s: string): string {
  // FNV-1a, enough to distinguish one string from another.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * `variant` covers everything OTHER than the file that changes what gets served.
 *
 * The file stamp alone was not enough once the preview stopped being the whole
 * book. An excerpt serves a slice of an unchanged archive, so moving the cut
 * from 60% to 40% produced identical bytes at an identical path — the token did
 * not move, and readers would have kept the old cut for a day. Anything that
 * changes the RESPONSE has to be in the key, not just anything that changes the
 * source.
 */
export function epubVersionToken(
  sourceRef: string | null | undefined,
  variant?: string | null,
): string {
  const suffix = variant ? `-${hash(variant)}` : "";
  if (!sourceRef) return `0${suffix}`;

  const base = sourceRef.split("?")[0].split("/").pop() ?? "";
  const stamp = base.match(/^(\d{10,})-/)?.[1];
  if (stamp) return `${stamp.slice(-9)}${suffix}`;

  return `${hash(sourceRef)}${suffix}`;
}

/** Append the token as a query param, preserving any the URL already has. */
export function withEpubVersion(endpoint: string, token: string): string {
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}v=${encodeURIComponent(token)}`;
}
