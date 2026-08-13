/**
 * "Does this record exist?", answered before the response starts.
 *
 * Every dynamic route in this app served a missing record as the 404 BODY under
 * a 200 status. The cause is that the response has already begun streaming by
 * the time `notFound()` runs inside the page, so the status is spent — a page
 * cannot set one. A rewrite from the proxy can, and the proxy runs first.
 *
 * So the check has to happen here, which means one indexed lookup on the request
 * path. That is a real cost, so it is:
 *   - scoped to the paths that can actually miss,
 *   - answered from an in-process cache for TTL_MS, and
 *   - fail-open: a Supabase hiccup renders the page rather than inventing a 404.
 */

const REST = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Long enough that a crawler sweeping a sitemap costs one query per slug. */
const TTL_MS = 60_000;
/** A bound, so a scripted 404 sweep cannot grow this without limit. */
const MAX_ENTRIES = 500;

const cache = new Map<string, { exists: boolean; at: number }>();

function remember(key: string, exists: boolean) {
  if (cache.size >= MAX_ENTRIES) {
    // Oldest insertion first — Map preserves order, and this is a cache, not an
    // index: evicting the wrong one costs one query.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { exists, at: Date.now() });
}

async function ask(url: string, cacheKey: string): Promise<boolean> {
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.exists;

  try {
    const res = await fetch(url, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      // The proxy must not hang on a slow database; the page can decide later.
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return true; // fail open
    const rows = (await res.json()) as unknown[];
    const exists = Array.isArray(rows) && rows.length > 0;
    remember(cacheKey, exists);
    return exists;
  } catch {
    return true; // fail open
  }
}

/** Slugs are lowercase alphanumerics and hyphens; anything else cannot exist. */
const SLUG = /^[a-z0-9-]+$/;

/**
 * True when the path names a record that is definitely not there.
 *
 * Only the routes whose 404 is a real outcome rather than a typo'd URL — an
 * unmatched path already 404s on its own.
 */
export async function isMissingRecord(pathname: string, host: string): Promise<boolean> {
  if (!REST || !KEY) return false;

  const page = /^\/p\/([^/]+)\/?$/.exec(pathname);
  if (page) {
    const slug = decodeURIComponent(page[1]).toLowerCase();
    if (!SLUG.test(slug)) return true;

    // Editorial pages are scoped per storefront, so the host has to be resolved
    // first. Both answers are cached, so a repeat visit costs nothing.
    const siteKey = `site:${host}`;
    const cachedSite = cache.get(siteKey);
    let siteId: string | null = null;

    if (cachedSite && Date.now() - cachedSite.at < TTL_MS && !cachedSite.exists) return false;

    try {
      const res = await fetch(
        `${REST}/lp_sites?select=id&host=eq.${encodeURIComponent(host)}&limit=1`,
        {
          headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
          signal: AbortSignal.timeout(1500),
        },
      );
      if (!res.ok) return false;
      const rows = (await res.json()) as { id: string }[];
      siteId = rows[0]?.id ?? null;
    } catch {
      return false;
    }
    // An unknown host is not this guard's problem to answer.
    if (!siteId) return false;

    const exists = await ask(
      `${REST}/lp_pages?select=id&site_id=eq.${siteId}&slug=eq.${encodeURIComponent(slug)}&published=eq.true&limit=1`,
      `page:${siteId}:${slug}`,
    );
    return !exists;
  }

  return false;
}
