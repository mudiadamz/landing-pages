"use client";

/**
 * Which "add to home screen" instructions a visitor needs.
 *
 * The steps differ per platform, and on iOS they differ per *browser*: only
 * Safari can install a web app, so Chrome/Firefox/Edge on iOS need to be told
 * to reopen the page in Safari rather than hunting for a menu item that isn't
 * there.
 */
export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "desktop";

export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";

  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports itself as a Mac, but a Mac has no touch screen.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) {
    // Every iOS browser is WebKit underneath and reports "Safari", so the
    // in-app browsers have to be excluded by their own tokens instead.
    const otherBrowser = /crios|fxios|edgios|opt\/|opera|duckduckgo|yabrowser/i.test(ua);
    // Facebook / Instagram / Line in-app webviews can't install either.
    const inApp = /fban|fbav|fb_iab|instagram|line\/|twitter|tiktok/i.test(ua);
    return otherBrowser || inApp ? "ios-other" : "ios-safari";
  }

  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export function isIOSPlatform(p: InstallPlatform): boolean {
  return p === "ios-safari" || p === "ios-other";
}

/**
 * Which language the device's own menus are in — the Share sheet and browser
 * menu follow the OS/browser locale, not our page. Used to label the buttons
 * the way the visitor will actually see them.
 *
 * Anything that isn't Indonesian is treated as English, which is what those
 * menus fall back to for most other locales. Note older Android reports
 * Indonesian with the legacy code "in" rather than "id".
 */
export function deviceMenuLanguage(): "id" | "en" {
  if (typeof navigator === "undefined") return "id";
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  const primary = (langs[0] || "").toLowerCase();
  return primary.startsWith("id") || primary.startsWith("in-") || primary === "in" ? "id" : "en";
}
