"use client";

/**
 * Tiny store for "has the visitor scrolled the reader yet".
 *
 * Several things on the first screen need this same fact — the scroll hint, the
 * identity chip — and each installing its own scroll listener would mean several
 * handlers running on every frame of a flick scroll, on the low-end Android
 * webviews that make up most of the ad traffic. So: one passive listener, shared,
 * and it uninstalls itself the moment it has fired. After the first scroll this
 * costs nothing at all.
 *
 * Deliberately window-scroll only. The inline EPUB reader flows in the document
 * (see epub-inline-viewer), which is what makes native scroll, taps and the iOS
 * address-bar collapse work — PDF/HTML previews scroll inside their own iframe
 * and are not observable from here.
 */

/** Ignore sub-pixel and bounce jitter; a real scroll clears this easily. */
const SCROLL_EPS = 8;

let scrolled = false;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

function uninstall() {
  if (!installed) return;
  window.removeEventListener("scroll", onScroll);
  installed = false;
}

function onScroll() {
  if (window.scrollY <= SCROLL_EPS) return;
  markScrolled();
}

/** Record the first scroll (also callable directly, e.g. from a "read on" tap). */
export function markScrolled(): void {
  if (scrolled) return;
  scrolled = true;
  uninstall();
  notify();
}

/** A new preview is mounting — the next book gets its own first scroll. */
export function resetFirstScroll(): void {
  const was = scrolled;
  scrolled = false;
  if (was) notify();
  if (typeof window !== "undefined" && !installed) {
    installed = true;
    window.addEventListener("scroll", onScroll, { passive: true });
  }
}

export function subscribeFirstScroll(fn: () => void): () => void {
  if (typeof window !== "undefined" && !installed && !scrolled) {
    installed = true;
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getScrolled(): boolean {
  return scrolled;
}

/** Server render: nobody has scrolled yet. */
export function getScrolledServer(): boolean {
  return false;
}
