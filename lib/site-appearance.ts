import type { Surfaces } from "@/lib/palette";
import { DEFAULT_BRAND_NAME, DEFAULT_ICON_512, brandInitials } from "@/lib/site-brand";

/**
 * What a storefront looks like *before* it has loaded.
 *
 * Every other surface in the app gets its colours from CSS custom properties, so
 * a template only has to declare `surfaces` and the whole page follows. The boot
 * surfaces cannot: the manifest's `background_color`, the `theme-color` meta and
 * the iOS launch image are all read by the OS *outside* the document, before a
 * single byte of CSS exists. They have to be told the same colours by hand, and
 * that is what this module is for — one answer, four consumers (app/manifest.ts,
 * app/layout.tsx, /api/splash, /api/site-icon), so a fifth surface can't quietly
 * disagree with the page it is covering.
 *
 * Pure and free of server imports on purpose: the layout, a route handler and a
 * unit test all need it, and only one of those has a request.
 */

/** The page colour of a storefront that declares no surfaces of its own. */
export const BOOT_BG_LIGHT = "#fdfcfb";
/**
 * Dark is NOT per-template. `html.dark` in globals.css sets `--background`
 * with a higher specificity than the `:root` rule a template's surfaces are
 * emitted into, so every template really does go to this exact colour in dark
 * mode — a per-template dark boot colour would be a promise the CSS breaks.
 */
export const BOOT_BG_DARK = "#0d0d0f";

/** The bits of a template that decide how it boots. Structural, so no import cycle. */
export type BootTheme = {
  surfaces?: Surfaces;
  lightOnly?: boolean;
};

export type SiteAppearance = {
  name: string;
  /** Two letters, drawn when there is no icon we can rasterise. */
  initials: string;
  /** Square mark to centre on generated art. Falls back to the ADM.UIUX default. */
  iconUrl: string;
  /** False when `iconUrl` is that fallback rather than this storefront's own upload. */
  hasOwnIcon: boolean;
  background: string;
  backgroundDark: string;
  lightOnly: boolean;
  /**
   * Cache token for the generated PNG routes. Changes whenever the name, icon or
   * colours change — and only then, which is what lets those routes be served
   * `immutable` for a year instead of re-rendered a 2048×2732 image per install.
   */
  version: string;
};

export function siteAppearance(
  site: { name?: string | null; icon_url?: string | null },
  theme: BootTheme = {},
): SiteAppearance {
  const name = site.name?.trim() || DEFAULT_BRAND_NAME;
  const own = site.icon_url?.trim() || "";
  const background = theme.surfaces?.background?.trim() || BOOT_BG_LIGHT;
  const lightOnly = !!theme.lightOnly;
  return {
    name,
    initials: brandInitials(name),
    iconUrl: own || DEFAULT_ICON_512,
    hasOwnIcon: !!own,
    background,
    // A light-only template never renders `html.dark`, so its dark-mode launch
    // image must still be the light one. Otherwise iOS shows a black cover and
    // the app underneath opens white — worse than no launch image at all.
    backgroundDark: lightOnly ? background : BOOT_BG_DARK,
    lightOnly,
    version: fingerprint([name, own, background, lightOnly ? "1" : "0"].join("|")),
  };
}

/**
 * Ink that stays legible on `bg`.
 *
 * Only used for the initials fallback, but it has to be computed rather than
 * picked per scheme: a light-only template's "dark" launch image is painted on
 * its light background, so keying the text colour off the scheme would write
 * white letters on cream.
 */
export function readableInk(bg: string): string {
  const rgb = parseHex(bg);
  if (!rgb) return "#1c1b1a";
  // Rec. 601 luma — enough to separate a cream from a charcoal, and it needs no
  // gamma table to do it.
  const luma = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  return luma > 140 ? "#1c1b1a" : "#f4f4f5";
}

function parseHex(value: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * djb2, base36. Not a security hash — its only job is to change when the inputs
 * change, so a CDN holding last month's splash for a domain that has since
 * rebranded is asked for a different URL instead of being trusted to expire.
 */
function fingerprint(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}
