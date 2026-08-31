import { cache } from "react";
import { cookies, headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PANEL_SITE_COOKIE } from "@/lib/panel-site";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "@/lib/i18n";

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
  /** Palette preset key; validated against lib/palette PALETTE_PRESETS. */
  palette: string;
  /** Wide wordmark for the header. NULL = the ADM.UIUX mark. */
  logo_url: string | null;
  /** Square mark: browser tab, PWA, iOS home screen, bio avatar. NULL = default. */
  icon_url: string | null;
  is_canonical: boolean;
  active: boolean;
  /** UI language. Must be a Locale in lib/i18n; the DB CHECK keeps them in step. */
  locale: Locale;
};

const SITE_COLUMNS =
  "id, host, name, tagline, description, category_ids, template, palette, logo_url, icon_url, is_canonical, active, locale";

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
  palette: "forest",
  logo_url: null,
  icon_url: null,
  is_canonical: true,
  active: true,
  locale: DEFAULT_LOCALE,
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
    return data ? { ...(data as Site), locale: normalizeLocale((data as Site).locale) } : null;
  },
  ["site-by-host"],
  // 60s, not 300: this is the value that decides which storefront a visitor sees,
  // and tag invalidation on unstable_cache proved unreliable enough that the TTL is
  // the real backstop. The row is one tiny select, so a shorter window costs little.
  { revalidate: 60, tags: ["sites"] },
);

const readCanonicalSite = unstable_cache(
  async (): Promise<Site | null> => {
    const { data, error } = await anonClient()
      .from("lp_sites")
      .select(SITE_COLUMNS)
      .eq("is_canonical", true)
      .maybeSingle();
    if (error) throw new Error(`canonical lp_sites lookup failed: ${error.message}`);
    return data ? { ...(data as Site), locale: normalizeLocale((data as Site).locale) } : null;
  },
  ["site-canonical"],
  { revalidate: 60, tags: ["sites"] },
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
 * domain, so the target cannot come from the host; it comes from the panel-wide
 * scope cookie set by the sidebar switcher (see lib/panel-site.ts).
 *
 * Was a `?site=` param, which forced a switcher onto every settings screen and lost
 * the choice on every navigation. A cookie survives the reload a server action
 * triggers and every link in the panel.
 *
 * The id is validated against the table rather than trusted, so a stale cookie (a
 * domain since deleted) or a hand-edited one can't write settings rows for a site
 * that doesn't exist. Anything unknown falls back to the canonical site, which is
 * what the screens did before they could target anything else.
 */
export const editingSite = cache(async (): Promise<Site> => {
  const allowed = await listMemberSites();
  const wanted = (await cookies()).get(PANEL_SITE_COOKIE)?.value?.trim();
  // Dicocokkan dengan situs yang BOLEH dibuka, bukan dengan semua situs. Cookie
  // ini dikirim browser: tanpa pencocokan itu, mengganti satu nilai di devtools
  // adalah pintu masuk ke storefront orang lain. Situs yang tidak boleh
  // dibuka jatuh ke situs pertama yang boleh — bukan ke kanonik, yang justru
  // situs yang paling mungkin bukan miliknya.
  const match = wanted ? allowed.find((s) => s.id === wanted) : undefined;
  if (match) return match;
  if (allowed.length) return allowed.find((s) => s.is_canonical) ?? allowed[0];
  // Bukan anggota situs mana pun (dan bukan platform admin). Panel tetap harus
  // merender sesuatu — layar-layarnya punya gate sendiri.
  const all = await listSites();
  return all.find((s) => s.is_canonical) ?? all[0] ?? FALLBACK_SITE;
});

/**
 * Situs yang boleh dibuka orang yang sedang login.
 *
 * Platform admin: semuanya. Selain itu: yang ada baris keanggotaannya
 * (fase 1 & 2 dari docs/plans/hierarchical-users.md).
 *
 * Sengaja di sini, bukan di lib/actions/profiles.ts: profiles.ts memanggil
 * editingSite(), jadi menaruhnya di sana membuat impor melingkar. Itu juga
 * alasan user & role dibaca langsung di bawah alih-alih lewat getProfile().
 */
export const listMemberSites = cache(async (): Promise<Site[]> => {
  const all = await listSites();
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    admin.from("lp_profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("lp_site_members").select("site_id").eq("user_id", user.id),
  ]);
  if (String(profile?.role ?? "").trim().toLowerCase() === "admin") return all;

  const mine = new Set((rows ?? []).map((r) => r.site_id as string));
  return all.filter((s) => mine.has(s.id));
});

/**
 * Admin-facing list for the panel. NOT cached across requests — admins have to see
 * their own writes, which is the whole reason this doesn't go through unstable_cache.
 *
 * React's `cache()` is per-request memoisation, not a cache in that sense: it dedupes
 * the calls WITHIN one render and forgets everything at the end. That matters now that
 * the panel layout resolves the site scope for the sidebar — layout and page each ask
 * for the list, and editingSite() asks again, which was four identical queries per
 * panel navigation. Now it is one.
 */
export const listSites = cache(async (): Promise<Site[]> => {
  const { data } = await anonClient()
    .from("lp_sites")
    .select(SITE_COLUMNS)
    .order("is_canonical", { ascending: false })
    .order("host", { ascending: true });
  return (data as Site[]) ?? [];
});
