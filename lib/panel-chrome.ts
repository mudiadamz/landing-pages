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

/* -------------------------------------------------------------------------- */
/*  Sidebar menu: pinned shortcuts and which groups are open                   */
/* -------------------------------------------------------------------------- */

/*
 * Every group starts folded; the menus someone actually uses are PINNED to a
 * section above them. Twenty-six entries in six open groups is a list that gets
 * searched rather than read, and which half-dozen matter differs per person —
 * so the rail shows nothing by default and lets each person choose.
 *
 * Cookies for the same reason as the collapsed rail: the layout reads them, so
 * the first paint already has the pins on top and the groups folded, instead of
 * drawing the full menu and rearranging it after hydration.
 */
export const PANEL_PINS_COOKIE = "panel_pins";
export const PANEL_GROUPS_COOKIE = "panel_groups";

/** Far more than anyone pins; it only bounds what a hand-edited cookie can hold. */
const MAX_PINS = 30;

/**
 * Pinned menu hrefs, in pin order. Only `/panel…` paths survive — the sidebar
 * renders a pin only when it matches a menu the person can reach, but nothing
 * else belongs in here either.
 */
export function parsePins(value: string | null | undefined): string[] {
  if (!value) return [];
  let raw: string;
  try {
    raw = decodeURIComponent(value);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const href of raw.split(",")) {
    if (/^\/panel(\/[\w-]+)*$/.test(href) && !out.includes(href)) out.push(href);
    if (out.length === MAX_PINS) break;
  }
  return out;
}

export function pinsCookie(pins: string[]): string {
  return `${PANEL_PINS_COOKIE}=${encodeURIComponent(pins.join(","))}; path=/; max-age=${PANEL_SIDEBAR_MAX_AGE}; samesite=lax`;
}

/**
 * Groups the person opened or closed themselves, by group key. A group with no
 * entry follows the default: folded, unless it holds the page on screen — you
 * should always be able to see where you are.
 */
export type GroupOverrides = Record<string, boolean>;

export function parseGroupOverrides(value: string | null | undefined): GroupOverrides {
  if (!value) return {};
  let raw: string;
  try {
    raw = decodeURIComponent(value);
  } catch {
    return {};
  }
  const out: GroupOverrides = {};
  for (const pair of raw.split(",")) {
    const m = /^([\w.-]+):([01])$/.exec(pair);
    if (m) out[m[1]] = m[2] === "1";
  }
  return out;
}

export function groupsCookie(overrides: GroupOverrides): string {
  const raw = Object.entries(overrides)
    .map(([k, open]) => `${k}:${open ? 1 : 0}`)
    .join(",");
  return `${PANEL_GROUPS_COOKIE}=${encodeURIComponent(raw)}; path=/; max-age=${PANEL_SIDEBAR_MAX_AGE}; samesite=lax`;
}

export function isGroupOpen(key: string, overrides: GroupOverrides, holdsActivePage: boolean): boolean {
  return overrides[key] ?? holdsActivePage;
}
