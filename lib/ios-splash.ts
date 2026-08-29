/**
 * iOS "Add to Home Screen" launch images.
 *
 * Unlike Android, iOS won't derive a launch screen from the web manifest — it
 * shows a blank white page while the app boots unless an exactly-matching
 * apple-touch-startup-image is declared. The media query has to match the
 * device's CSS size and pixel ratio precisely, so every supported screen needs
 * its own entry (and its own image).
 *
 * The images are RENDERED PER REQUEST by /api/splash rather than shipped as
 * files in public/. They used to be 34 PNGs baked from public/icon-512.png at
 * build time — which is a build-time asset, and a build-time asset cannot vary
 * by host, so every niche domain launched under the ADM.UIUX mark on the
 * ADM.UIUX background. Same reason app/icon.svg had to move to public/ for the
 * favicon to follow the storefront (see docs/multi-domain.md).
 *
 * Portrait only: the app's manifest locks orientation to portrait.
 * Sizes are `cssWidth x cssHeight @ratio`; the rendered PNG is the pixel size.
 */
export type SplashTarget = {
  /** CSS pixels */
  w: number;
  h: number;
  /** devicePixelRatio */
  r: number;
};

export type SplashScheme = "light" | "dark";

export const IOS_SPLASH_TARGETS: SplashTarget[] = [
  // iPhone
  { w: 320, h: 568, r: 2 }, // SE (1st gen)
  { w: 375, h: 667, r: 2 }, // 8, SE (2nd/3rd gen)
  { w: 414, h: 736, r: 3 }, // 8 Plus
  { w: 375, h: 812, r: 3 }, // X, XS, 11 Pro
  { w: 414, h: 896, r: 2 }, // XR, 11
  { w: 414, h: 896, r: 3 }, // XS Max, 11 Pro Max
  { w: 390, h: 844, r: 3 }, // 12, 13, 14
  { w: 393, h: 852, r: 3 }, // 14 Pro, 15, 16
  { w: 402, h: 874, r: 3 }, // 16 Pro
  { w: 428, h: 926, r: 3 }, // 12/13/14 Pro Max
  { w: 430, h: 932, r: 3 }, // 14 Pro Max, 15/16 Plus & Pro Max
  { w: 440, h: 956, r: 3 }, // 16 Pro Max
  // iPad
  { w: 768, h: 1024, r: 2 }, // Mini, Air (legacy)
  { w: 810, h: 1080, r: 2 }, // 10.2"
  { w: 834, h: 1112, r: 2 }, // Pro 10.5"
  { w: 834, h: 1194, r: 2 }, // Pro 11"
  { w: 1024, h: 1366, r: 2 }, // Pro 12.9"
];

/** The share of the shorter edge the mark occupies. Matches the old baked images. */
export const SPLASH_MARK_RATIO = 0.34;

export function splashUrl(t: SplashTarget, scheme: SplashScheme, version: string): string {
  return `/api/splash/${t.w * t.r}x${t.h * t.r}-${scheme}.png?v=${version}`;
}

/**
 * Parse `1170x2532-dark.png` back into a render request — and refuse anything
 * that isn't one of OUR sizes.
 *
 * The allow-list is the point. A route that renders whatever dimensions the URL
 * asks for is an open image generator: one request for 20000×20000 is a server
 * out of memory, and it needs no session to send.
 */
export function parseSplashSpec(
  spec: string,
): { width: number; height: number; scheme: SplashScheme } | null {
  const m = /^(\d{2,5})x(\d{2,5})-(light|dark)\.png$/.exec(spec);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  const known = IOS_SPLASH_TARGETS.some((t) => t.w * t.r === width && t.h * t.r === height);
  if (!known) return null;
  return { width, height, scheme: m[3] as SplashScheme };
}

/**
 * iOS picks the first startup image whose media query matches, so light and
 * dark must each pin prefers-color-scheme — otherwise both match and the
 * choice is arbitrary.
 */
export function splashMedia(t: SplashTarget, scheme: SplashScheme): string {
  return (
    `(device-width: ${t.w}px) and (device-height: ${t.h}px) and ` +
    `(-webkit-device-pixel-ratio: ${t.r}) and (orientation: portrait) and ` +
    `(prefers-color-scheme: ${scheme})`
  );
}
