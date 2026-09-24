/* Blogger/Blogspot URL shapes, as data rather than as string concatenation
 * scattered across five route files.
 *
 * The whole point of the blog template is that a site moved off Blogger keeps
 * every address it had. Ten years of backlinks, search results and other
 * people's bookmarks point at these exact strings, and a URL scheme that is
 * "basically the same" is a scheme that 404s.
 *
 *   post      /2026/09/judul-tulisan.html
 *   page      /p/judul-halaman.html
 *   label     /search/label/Nama%20Label
 *   search    /search?q=kata
 *   archive   /2026/09/  and  /2026/
 *   feed      /feeds/posts/default  (+ ?alt=rss), /rss.xml, /atom.xml
 *
 * Two details that look like typos and are not:
 *
 *  - the month is ALWAYS two digits (`/2026/09/`, never `/2026/9/`);
 *  - the `.html` suffix is part of the address, not a file extension we are
 *    free to drop. It is also the only thing separating a Blogger page from
 *    this app's own `/p/[slug]` editorial pages.
 *
 * Framework-free: the routes, the importer (plain Node, no TS build) and the
 * feed builder all need the same answers.
 */

/** A path this module produced, or that Blogger did. Always starts with "/". */
export type BlogPath = string;

const YEAR = /^\d{4}$/;
const MONTH = /^(0[1-9]|1[0-2])$/;

export function isYearSegment(value: string): boolean {
  // 1999 is Blogger's own epoch in its id scheme; nothing sensible predates it,
  // and the upper bound keeps a stray 5-digit path out of the archive route.
  if (!YEAR.test(value)) return false;
  const y = Number(value);
  return y >= 1999 && y <= 9999;
}

export function isMonthSegment(value: string): boolean {
  return MONTH.test(value);
}

/** Two-digit month from a Date, in UTC — the archive is a fact, not a timezone. */
export function monthSegment(d: Date): string {
  return String(d.getUTCMonth() + 1).padStart(2, "0");
}

export function yearSegment(d: Date): string {
  return String(d.getUTCFullYear());
}

/**
 * The address a NEW post gets.
 *
 * Only for posts written here. An imported post keeps the path its export
 * carried, because Blogger froze that string at first publication and derived
 * it with truncation rules that were never documented — recomputing it would
 * quietly move a post to an address that never existed.
 */
export function buildPostPath(publishedAt: Date, slug: string): BlogPath {
  return `/${yearSegment(publishedAt)}/${monthSegment(publishedAt)}/${slug}.html`;
}

export function buildPagePath(slug: string): BlogPath {
  return `/p/${slug}.html`;
}

/**
 * Strip the trailing `.html`, returning null when it is not there.
 *
 * Null is the signal that a request is NOT for this template — `/p/about` is
 * this app's editorial page, `/p/about.html` is the imported Blogger one, and
 * the two must not be able to shadow each other.
 */
export function stripHtmlSuffix(segment: string): string | null {
  return segment.endsWith(".html") ? segment.slice(0, -".html".length) : null;
}

/** Rebuild the canonical path from route segments, or null if they aren't one. */
export function postPathFromSegments(
  year: string,
  month: string,
  lastSegment: string,
): BlogPath | null {
  if (!isYearSegment(year) || !isMonthSegment(month)) return null;
  const slug = stripHtmlSuffix(lastSegment);
  if (!slug) return null;
  return `/${year}/${month}/${slug}.html`;
}

export function labelPath(label: string): BlogPath {
  // Blogger percent-encodes the label and leaves nothing else alone: spaces
  // become %20, not "+" and not "-". encodeURIComponent matches it, except for
  // "!'()*", which it leaves raw and Blogger also leaves raw.
  return `/search/label/${encodeURIComponent(label)}`;
}

export function archivePath(year: string | number, month?: string | number): BlogPath {
  const y = String(year);
  if (month === undefined) return `/${y}/`;
  return `/${y}/${String(month).padStart(2, "0")}/`;
}

export function searchPath(query: string): BlogPath {
  return `/search?q=${encodeURIComponent(query)}`;
}

/**
 * Blogger's slug rules, for posts written here rather than imported.
 *
 * Lowercased, non-alphanumerics collapsed to single hyphens, and cut at 40
 * characters on a WORD boundary — Blogger does not leave a half word at the
 * end, and a slug ending in a hyphen is the tell that someone reimplemented
 * this with a plain `slice`.
 */
export function bloggerSlug(title: string, max = 40): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= max) return base;
  const cut = base.slice(0, max);
  const lastHyphen = cut.lastIndexOf("-");
  // A single word longer than the limit has no boundary to cut on; the hard
  // slice is then the only answer, and Blogger makes the same one.
  return (lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, "");
}

/** The month a stored path belongs to, for breadcrumbs and archive links. */
export function archiveOfPath(path: BlogPath): { year: string; month: string } | null {
  const m = path.match(/^\/(\d{4})\/(\d{2})\//);
  return m ? { year: m[1], month: m[2] } : null;
}
