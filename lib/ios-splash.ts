/**
 * iOS "Add to Home Screen" launch images.
 *
 * Unlike Android, iOS won't derive a launch screen from the web manifest — it
 * shows a blank white page while the app boots unless an exactly-matching
 * apple-touch-startup-image is declared. The media query has to match the
 * device's CSS size and pixel ratio precisely, so every supported screen needs
 * its own entry (and its own generated PNG).
 *
 * Portrait only: the app's manifest locks orientation to portrait.
 * Sizes are `cssWidth x cssHeight @ratio`; the PNG is the pixel size.
 */
export type SplashTarget = {
  /** CSS pixels */
  w: number;
  h: number;
  /** devicePixelRatio */
  r: number;
};

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

/** Background matches the app's --background so the boot is seamless. */
export const SPLASH_BG = { light: "#fdfcfb", dark: "#0d0d0f" } as const;

export function splashFile(t: SplashTarget, scheme: "light" | "dark"): string {
  return `/splash/apple-splash-${t.w * t.r}-${t.h * t.r}${scheme === "dark" ? "-dark" : ""}.png`;
}

/**
 * iOS picks the first startup image whose media query matches, so light and
 * dark must each pin prefers-color-scheme — otherwise both match and the
 * choice is arbitrary.
 */
export function splashMedia(t: SplashTarget, scheme: "light" | "dark"): string {
  return (
    `(device-width: ${t.w}px) and (device-height: ${t.h}px) and ` +
    `(-webkit-device-pixel-ratio: ${t.r}) and (orientation: portrait) and ` +
    `(prefers-color-scheme: ${scheme})`
  );
}
