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
 *   - fail-open: a database hiccup renders the page rather than inventing a 404.
 *
 * Asks Postgres directly, as the `anon` role — the same view of the data a
 * logged-out visitor has, which is what PostgREST gave it before. This runs in
 * proxy.ts, which Next 16 executes on the Node runtime (unlike the old Edge
 * middleware), so the database driver is available here.
 */

import { withRls } from "@/lib/backend/rls";

/** The proxy must not hang on a slow database; the page can decide later. */
const TIMEOUT_MS = 1500;

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

/** First row of a query as a logged-out visitor, or throws after TIMEOUT_MS. */
async function firstRow<T>(sql: string, params: unknown[]): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      withRls("anon", async (c) => (await c.query(sql, params)).rows[0] as T | undefined),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("missing-record: timeout")), TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function ask(sql: string, params: unknown[], cacheKey: string): Promise<boolean> {
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.exists;

  try {
    const exists = (await firstRow(sql, params)) !== undefined;
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
  if (!process.env.DATABASE_URL) return false;

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
      const row = await firstRow<{ id: string }>("select id from lp_sites where host = $1 limit 1", [host]);
      siteId = row?.id ?? null;
    } catch {
      return false;
    }
    // An unknown host is not this guard's problem to answer.
    if (!siteId) return false;

    const exists = await ask(
      "select 1 from lp_pages where site_id = $1 and slug = $2 and published limit 1",
      [siteId, slug],
      `page:${siteId}:${slug}`,
    );
    return !exists;
  }

  const checkout = /^\/checkout\/([^/]+)\/?$/.exec(pathname);
  if (checkout) {
    const slug = decodeURIComponent(checkout[1]).toLowerCase();
    if (!SLUG.test(slug)) return true;

    // Existence ONLY — never publish state. An unpublished product is still
    // reachable by its owner (see getLandingPageForCheckout), so a guard that
    // 404'd drafts would lock a seller out of previewing their own page.
    // Products are global by slug, so no site lookup is needed here.
    const exists = await ask("select 1 from lp_landing_pages where slug = $1 limit 1", [slug], `product:${slug}`);
    return !exists;
  }

  // /preview/[slug] is deliberately absent. It is the surface an ad clicks into,
  // so it carries the strictest load budget in the app, and a lookup here would
  // be paid by every visitor to buy one 404 for the few who mistype a URL.
  return false;
}
