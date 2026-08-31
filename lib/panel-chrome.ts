/**
 * The panel shell's remembered state: is the desktop sidebar collapsed?
 *
 * A cookie rather than localStorage, for the same reason the theme is a cookie:
 * the layout is a server component, so it can read this and render the collapsed
 * width in the FIRST paint. Read on the client instead and every page load would
 * draw a 256px sidebar and then snap it to 64px after hydration.
 *
 * Framework-free so the server layout and the client toggle can share it.
 */
export const PANEL_SIDEBAR_COOKIE = "panel_sidebar";

/** A year. It is a preference, not a session. */
export const PANEL_SIDEBAR_MAX_AGE = 60 * 60 * 24 * 365;

const COLLAPSED = "collapsed";

export function isSidebarCollapsed(value: string | null | undefined): boolean {
  return value === COLLAPSED;
}

/** The `document.cookie` string that records a new choice. */
export function sidebarCookie(collapsed: boolean): string {
  const value = collapsed ? COLLAPSED : "open";
  return `${PANEL_SIDEBAR_COOKIE}=${value}; path=/; max-age=${PANEL_SIDEBAR_MAX_AGE}; samesite=lax`;
}
