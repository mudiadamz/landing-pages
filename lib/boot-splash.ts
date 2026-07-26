"use client";

/**
 * Dismissal for the server-rendered cover splash (components/epub-boot-splash.tsx).
 * The splash lives outside React's tree — it ships in the streamed shell before
 * any component mounts — so it's removed by direct DOM access.
 */

export const SPLASH_FADE_MS = 400;

/**
 * Hold the cover for at least this long after navigation start. The book can be
 * ready in a few hundred ms, and a cover that vanishes the instant it appears
 * reads as a flicker rather than a title card.
 */
export const MIN_SPLASH_MS = 1100;

export function dismissBootSplash(minVisibleMs = MIN_SPLASH_MS): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById("epub-boot");
  if (!el) return;

  const elapsed = typeof performance !== "undefined" ? performance.now() : minVisibleMs;
  window.setTimeout(
    () => {
      el.classList.add("is-done");
      window.setTimeout(() => el.remove(), SPLASH_FADE_MS + 50);
    },
    Math.max(0, minVisibleMs - elapsed),
  );
}
