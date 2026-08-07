import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";

/**
 * Which storefront is this request for?
 *
 * One deployment serves every domain, so "which site" is a property of the
 * request, not of the build. That creates the trap this module exists to avoid:
 *
 *   unstable_cache CANNOT read headers(). It refuses dynamic data sources, the
 *   same way it refuses cookies(). So the host is read OUTSIDE the cache and
 *   passed IN as an argument — and because unstable_cache derives its key from
 *   the arguments, that is also what stops one domain from serving another
 *   domain's hero, popup, or product list out of a shared cache entry.
 *
 * Every per-site reader in the app follows the same shape: take siteId as an
 * argument, never look it up inside the cached function.
 */

export type Site = {
  id: string;
  host: string;
  name: string;
  /** Short headline, used in the page title. */
  tagline: string | null;
  /** Search snippet. Separate from the tagline: different length, different job. */
  description: string | null;
  /** Root categories this storefront covers. Empty = the whole catalog. */
  category_ids: string[];
  /** Frontend template key; validated against lib/templates/registry. */
  template: string;
  is_canonical: boolean;
  active: boolean;
};

const SITE_COLUMNS =
  "id, host, name, tagline, description, category_ids, template, is_canonical, active";

/**
 * Used when lp_sites is empty or unreachable — a fresh database, or the migration
 * not yet applied. An empty id means the settings readers find no rows and fall
 * back to their defaults, and an empty category list means the whole catalog
 * shows. So an unconfigured deployment behaves exactly like the single-site app
 * it was before, instead of serving a blank storefront.
 */
const FALLBACK_SITE: Site = {
  id: "",
  host: "",
  name: "ADM.UIUX",
  tagline: null,
  description: null,
  category_ids: [],
  template: "default",
  is_canonical: true,
  active: true,
};

function anonClient() {
  return createSupabaseJS(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** "Resepku.com:3000" -> "resepku.com". Ports and case break host matching. */
export function normalizeHost(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().split(":")[0];
}

/*
 * These deliberately THROW on a database error instead of returning null.
 *
 * unstable_cache stores whatever the function returns, including a null produced
 * by a swallowed failure — so a single blip would pin "this domain is unknown"
 * for the whole revalidate window, and every storefront would quietly serve the
 * fallback for five minutes. An exception is not cached, so the next request
 * retries. "No such host" is a real answer and IS cached; "the query failed" is
 * not an answer at all.
 */

const readSiteByHost = unstable_cache(
  async (host: string): Promise<Site | null> => {
    if (!host) return null;
    const { data, error } = await anonClient()
      .from("lp_sites")
      .select(SITE_COLUMNS)
      .eq("host", host)
      .maybeSingle();
    if (error) throw new Error(`lp_sites lookup failed for ${host}: ${error.message}`);
    return (data as Site) ?? null;
  },
  ["site-by-host"],
  { revalidate: 300, tags: ["sites"] },
);

const readCanonicalSite = unstable_cache(
  async (): Promise<Site | null> => {
    const { data, error } = await anonClient()
      .from("lp_sites")
      .select(SITE_COLUMNS)
      .eq("is_canonical", true)
      .maybeSingle();
    if (error) throw new Error(`canonical lp_sites lookup failed: ${error.message}`);
    return (data as Site) ?? null;
  },
  ["site-canonical"],
  { revalidate: 300, tags: ["sites"] },
);

/** Swallows the throw at the edge, where it can't be written to the cache. */
async function safeSiteByHost(host: string): Promise<Site | null> {
  try {
    return await readSiteByHost(host);
  } catch (e) {
    console.error("site-resolve:", e);
    return null;
  }
}

async function safeCanonicalSite(): Promise<Site | null> {
  try {
    return await readCanonicalSite();
  } catch (e) {
    console.error("site-resolve:", e);
    return null;
  }
}

/** The host this request arrived on. Vercel forwards the real one. */
export async function currentHost(): Promise<string> {
  const h = await headers();
  return normalizeHost(h.get("x-forwarded-host") ?? h.get("host"));
}

/**
 * The site serving this request. Falls back to the canonical site for any host
 * we don't recognise — preview deployments, *.vercel.app, a domain pointed at us
 * before it was added in the panel — and for a site that exists but is switched
 * off, so parking a domain never yields a broken page.
 */
export async function currentSite(): Promise<Site> {
  const host = await currentHost();
  const match = host ? await safeSiteByHost(host) : null;
  if (match && match.active) return match;
  return (await safeCanonicalSite()) ?? FALLBACK_SITE;
}

export async function currentSiteId(): Promise<string> {
  return (await currentSite()).id;
}

/**
 * Where settings that are NOT per-storefront live: the panel palette and the
 * role permission matrix. Those are admin-facing, identical for every domain, and
 * pinning them to the canonical site keeps one row instead of a copy per site
 * that could silently disagree.
 */
export async function canonicalSiteId(): Promise<string> {
  return (await safeCanonicalSite())?.id ?? "";
}

/**
 * Is this request on the canonical domain? The panel lives only there, so niche
 * domains don't need their own admin login (Supabase session cookies are
 * per-domain and do not cross).
 */
export async function isCanonicalRequest(): Promise<boolean> {
  return (await currentSite()).is_canonical;
}

/** Origin of the domain the visitor is actually on, for canonical URLs and OG. */
export async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return canonicalOrigin();
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * The one fixed origin. Duitku's server-to-server callback must land on a single
 * known host regardless of which storefront the buyer started from, and email
 * links are built outside any request.
 */
export function canonicalOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://admuiux.com").replace(/\/$/, "");
}

/**
 * Which storefront a panel settings screen is EDITING — a different question from
 * which one is serving the request. The panel only ever runs on the canonical
 * domain, so the target comes from a `?site=` param instead of the host.
 *
 * The id is validated against the table rather than trusted, so a hand-edited URL
 * can't write settings rows for a site that doesn't exist. Anything unknown falls
 * back to the canonical site, which is what the screens did before they could
 * target anything else.
 */
export async function editingSite(siteParam?: string | string[]): Promise<Site> {
  const wanted = (Array.isArray(siteParam) ? siteParam[0] : siteParam)?.trim();
  const all = await listSites();
  const match = wanted ? all.find((s) => s.id === wanted) : undefined;
  return (
    match ??
    all.find((s) => s.is_canonical) ??
    all[0] ??
    FALLBACK_SITE
  );
}

/** Admin-facing list for the panel. Not cached — admins need to see writes. */
export async function listSites(): Promise<Site[]> {
  const { data } = await anonClient()
    .from("lp_sites")
    .select(SITE_COLUMNS)
    .order("is_canonical", { ascending: false })
    .order("host", { ascending: true });
  return (data as Site[]) ?? [];
}
