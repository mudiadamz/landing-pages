/**
 * Which storefront the panel is currently managing.
 *
 * Kept in a cookie rather than in `?site=` on every URL. The param version meant a
 * separate switcher on every settings screen, and the choice was lost the moment you
 * navigated — pick a niche domain on Hero, click Popup, and you were silently back on
 * the canonical site. One control in the sidebar, one value, carried across the whole
 * panel.
 *
 * The value is a site id, and it is NEVER trusted: `editingSite()` looks it up in
 * lp_sites and falls back to the canonical site, so a stale id (a deleted domain) or a
 * hand-edited cookie degrades to the default instead of writing settings rows for a
 * site that does not exist. It selects a scope for an admin; it grants nothing — every
 * write still passes requireAdmin()/requireFeature().
 *
 * No server imports here, so client components can read the cookie name too.
 */
export const PANEL_SITE_COOKIE = "panel_site";

/** A year: this is a workspace preference, not a session. */
export const PANEL_SITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Scoped to the panel — nothing public reads it. */
export const PANEL_SITE_COOKIE_PATH = "/panel";

/** The serialisable shape the sidebar switcher needs. */
export type PanelSiteOption = {
  id: string;
  host: string;
  name: string;
  is_canonical: boolean;
};
