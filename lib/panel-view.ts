/* Which panel a person is LOOKING at, as opposed to which one they qualify for.
 *
 * `lib/panel-shell.ts` answers "does this person only ever buy" — a fact about
 * their permissions. This answers a different question: someone who runs a shop
 * ALSO buys things, and until now the panel refused to admit it. A business
 * owner's own purchases and favourites were reachable only because those two
 * entries were bolted into the twenty-six-slot admin rail, which is why they
 * looked so out of place there.
 *
 * So the shell becomes a choice, not a verdict:
 *
 *   customer-only person  → account shell, always. There is nothing to switch to.
 *   everybody else        → their stored preference, business by default.
 *
 * Pure and framework-free so the layout, the toggle and the tests all agree on
 * the rule without a request between them.
 */

export const PANEL_VIEW_COOKIE = "lp_panel_view";

export type PanelView = "business" | "customer";

/** A stored value we recognise, or null. */
export function normalizePanelView(value: unknown): PanelView | null {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "business" || s === "customer" ? s : null;
}

/**
 * The shell to render.
 *
 * `customerOnly` WINS over the cookie, in that direction only. Someone with no
 * business capabilities has no business shell to be shown — a stale or
 * hand-edited cookie must not hand them a rail full of menus that all refuse
 * them. The other direction is a free choice, so it is honoured.
 */
export function resolvePanelView(cookie: unknown, customerOnly: boolean): PanelView {
  if (customerOnly) return "customer";
  return normalizePanelView(cookie) ?? "business";
}

/** Can this person switch at all? Only if they have somewhere to switch from. */
export function canSwitchPanelView(customerOnly: boolean): boolean {
  return !customerOnly;
}

/* -------------------------------------------------------------------------- */
/*  Denied access                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Where a refused page sends someone, and what it says when they get there.
 *
 * Every gated screen in the panel answered a failed check with a bare
 * `redirect("/panel")` — the menu vanished mid-click and the dashboard appeared
 * with no explanation. Indistinguishable from a misclick, and the one thing it
 * never told anyone was which permission they were missing.
 *
 * The menu key travels in the query string rather than a flash cookie: it is
 * not secret, it survives the redirect without state, and a link someone pastes
 * into a support chat still explains itself.
 */
export const DENIED_PARAM = "denied";

/** Kept short and known so an arbitrary string cannot be reflected onto the page. */
const DENIABLE = new Set([
  "sites", "appearance", "plans", "roles", "users", "analytics", "domains",
  "branding", "links", "tracking", "popup", "pages", "products", "assets",
  "sales", "platform", "storage", "categories", "contacts", "inbox", "hero",
  "content", "legal", "hiring", "custom-js", "business",
]);

export function deniedPath(menu: string): string {
  return DENIABLE.has(menu) ? `/panel?${DENIED_PARAM}=${menu}` : "/panel";
}

/** The menu named by a `?denied=` parameter, or null if it names nothing we know. */
export function deniedMenu(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const s = String(raw ?? "").trim().toLowerCase();
  return DENIABLE.has(s) ? s : null;
}
