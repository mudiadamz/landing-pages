// Shared EPUB reader font-size state. The control lives in the actions ("⋯")
// menu, while the reader (EpubViewer) is a separate component — they sync via a
// window CustomEvent plus a persisted localStorage value (so the choice sticks
// across books/sessions). Both are SSR-safe (guarded reads).

export type EpubFontLevel = "small" | "medium" | "large";

export const EPUB_FONT_SIZES: Record<EpubFontLevel, string> = {
  small: "90%",
  medium: "112%",
  large: "140%",
};

export const EPUB_FONT_KEY = "lp-epub-font";
export const EPUB_FONT_EVENT = "lp-epub-font";

/** Current preference (falls back to "medium" on the server / when unset). */
export function readEpubFont(): EpubFontLevel {
  try {
    const v = localStorage.getItem(EPUB_FONT_KEY);
    if (v === "small" || v === "medium" || v === "large") return v;
  } catch {
    /* storage unavailable / SSR */
  }
  return "medium";
}

/** Persist + broadcast a new size so any open reader applies it immediately. */
export function setEpubFont(level: EpubFontLevel): void {
  try {
    localStorage.setItem(EPUB_FONT_KEY, level);
  } catch {
    /* best-effort */
  }
  try {
    window.dispatchEvent(new CustomEvent(EPUB_FONT_EVENT, { detail: level }));
  } catch {
    /* best-effort */
  }
}
