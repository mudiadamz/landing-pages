/**
 * Reading data "for one storefront" when some of it predates the question.
 *
 * `site_id` was added to lp_sessions, lp_page_events, lp_purchases, lp_contacts and
 * lp_reviews long after those tables started filling up, and attribution cannot be
 * back-filled — nothing ever recorded which of our domains a visit or a payment landed
 * on. So every historical row is NULL, and every panel screen that filters by site has
 * to decide what NULL means.
 *
 * It means the canonical site. Not a guess dressed as a fact: this deployment served
 * exactly one domain for the whole period those rows were written, so the canonical
 * site is where they came from. The alternatives are worse — hiding them makes the main
 * site's history vanish from its own sales screen, and showing them under every domain
 * would credit a niche storefront with traffic it never had.
 *
 * The consequence is worth stating plainly wherever numbers are shown: a niche domain
 * reads zero until new data arrives under it. That is an honest zero, not a broken
 * query, and SiteScopeCoverage says so on screen.
 */

/** Supabase `.or()` filter, or null when no filtering is needed. */
export type SiteScopeFilter = { or: string } | null;

/**
 * Rows belonging to `siteId`, plus the unattributed ones when it is the canonical site.
 *
 * Returns null — meaning "no filter, take everything" — when there is only one site, so
 * a single-domain deployment issues exactly the queries it did before this existed.
 */
export function siteScopeFilter(opts: {
  siteId: string;
  isCanonical: boolean;
  siteCount: number;
}): SiteScopeFilter {
  if (opts.siteCount < 2 || !opts.siteId) return null;
  return opts.isCanonical
    ? { or: `site_id.eq.${opts.siteId},site_id.is.null` }
    : { or: `site_id.eq.${opts.siteId}` };
}

/**
 * Applies the filter to a Supabase query builder.
 *
 * Typed loosely on purpose: PostgrestFilterBuilder's generics differ per table and per
 * select, and threading them through would mean a signature per call site for a helper
 * whose whole job is one conditional `.or()`.
 */
export function withSiteScope<T extends { or: (f: string) => T }>(
  query: T,
  filter: SiteScopeFilter,
): T {
  return filter ? query.or(filter.or) : query;
}

/* -------------------------------------------------------------------------- *
 * Server-side resolver. Everything above is pure; this part reads the panel's
 * scope cookie, so the module as a whole is server-only (nothing client-side
 * imports it).
 * -------------------------------------------------------------------------- */

import { editingSite, listSites, type Site } from "@/lib/site-resolve";

export type PanelScope = {
  site: Site;
  siteCount: number;
  filter: SiteScopeFilter;
  /** True when unattributed rows are being counted in — the canonical branch. */
  includesUnattributed: boolean;
};

/**
 * The scope every admin screen filters by: whichever storefront the sidebar switcher
 * points at.
 *
 * One helper rather than the same four lines in each reader, because getting it wrong is
 * invisible — a missing filter shows MORE data than it should, which looks like success.
 */
export async function panelScope(): Promise<PanelScope> {
  const [site, sites] = await Promise.all([editingSite(), listSites()]);
  const filter = siteScopeFilter({
    siteId: site.id,
    isCanonical: site.is_canonical,
    siteCount: sites.length,
  });
  return {
    site,
    siteCount: sites.length,
    filter,
    includesUnattributed: !!filter && site.is_canonical,
  };
}
