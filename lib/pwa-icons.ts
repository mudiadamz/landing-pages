/**
 * Home-screen icons, rendered per storefront by /api/site-icon.
 *
 * The raw upload already covers the browser tab and the manifest's `any` entry,
 * so this exists for the two jobs a raw upload cannot do:
 *
 *   apple     iOS ignores SVG for apple-touch-icon and does not composite a
 *             background behind a transparent PNG — it renders it on black. A
 *             storefront whose icon is an SVG had no home-screen icon at all.
 *   maskable  Android crops the icon to whatever shape the launcher uses. A
 *             mark that fills its square loses its corners; the maskable entry
 *             is the same mark drawn small enough to survive the crop.
 *
 * Both are flattened onto the storefront's own background, which is also why
 * they can't be one shared build-time file.
 */
export type IconPurpose = "apple" | "any" | "maskable";

export type IconSpec = {
  size: number;
  purpose: IconPurpose;
  /** Share of the square the mark occupies. */
  markRatio: number;
};

/**
 * The only icons this route will draw. An allow-list rather than a parsed size,
 * for the same reason as the splash sizes: an open image generator is a denial
 * of service that needs no login.
 */
const ICON_SPECS: Record<string, IconSpec> = {
  // 180 is what iOS asks for; the mark nearly fills it because iOS applies its
  // own rounded-rect mask, which crops far less than an Android circle.
  "apple-180.png": { size: 180, purpose: "apple", markRatio: 0.82 },
  // 0.6 keeps the mark inside the maskable safe zone (a circle of 80% diameter)
  // with room to spare, so a launcher that crops hard still shows a whole logo.
  "maskable-192.png": { size: 192, purpose: "maskable", markRatio: 0.6 },
  "maskable-512.png": { size: 512, purpose: "maskable", markRatio: 0.6 },
  // The rasterised fallback for a storefront whose upload is an SVG: Chrome
  // takes SVG, but a few Android launchers and the Windows installer do not.
  "icon-192.png": { size: 192, purpose: "any", markRatio: 0.82 },
  "icon-512.png": { size: 512, purpose: "any", markRatio: 0.82 },
};

export function parseIconSpec(spec: string): IconSpec | null {
  // hasOwn, not a plain lookup: `ICON_SPECS["toString"]` finds a function on
  // Object.prototype, and `?? null` would happily hand it to the route.
  return Object.hasOwn(ICON_SPECS, spec) ? ICON_SPECS[spec] : null;
}

export function iconUrl(spec: keyof typeof ICON_SPECS | string, version: string): string {
  return `/api/site-icon/${spec}?v=${version}`;
}

export const APPLE_ICON_SPEC = "apple-180.png";
export const MASKABLE_192_SPEC = "maskable-192.png";
export const MASKABLE_512_SPEC = "maskable-512.png";
export const ICON_192_SPEC = "icon-192.png";
export const ICON_512_SPEC = "icon-512.png";
