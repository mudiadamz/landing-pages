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

/* -------------------------------------------------------------------------- */
/*  Display margin (horizontal padding of the text column)                    */
/* -------------------------------------------------------------------------- */

export type EpubMarginLevel = "narrow" | "medium" | "wide";
export const EPUB_MARGIN_SIZES: Record<EpubMarginLevel, string> = {
  narrow: "0.5rem",
  medium: "1.75rem",
  wide: "3.5rem",
};
export const EPUB_MARGIN_KEY = "lp-epub-margin";
export const EPUB_MARGIN_EVENT = "lp-epub-margin";

export function readEpubMargin(): EpubMarginLevel {
  try {
    const v = localStorage.getItem(EPUB_MARGIN_KEY);
    if (v === "narrow" || v === "medium" || v === "wide") return v;
  } catch {
    /* storage unavailable / SSR */
  }
  return "narrow";
}

export function setEpubMargin(level: EpubMarginLevel): void {
  try {
    localStorage.setItem(EPUB_MARGIN_KEY, level);
  } catch {
    /* best-effort */
  }
  try {
    window.dispatchEvent(new CustomEvent(EPUB_MARGIN_EVENT, { detail: level }));
  } catch {
    /* best-effort */
  }
}
