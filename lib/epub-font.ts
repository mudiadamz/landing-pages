// Shared EPUB reader font-size state. The control lives in the actions ("⋯")
// menu, while the reader (EpubViewer) is a separate component — they sync via a
// window CustomEvent plus a persisted localStorage value (so the choice sticks
// across books/sessions). Both are SSR-safe (guarded reads).

// Font size as a percent (applied via rendition.themes.fontSize).
export const EPUB_FONT_KEY = "lp-epub-font";
export const EPUB_FONT_EVENT = "lp-epub-font";
// 100% is the comfortable baseline (the reader applies it to an ~19px base, so
// "100%" reads like the old ~118%).
export const EPUB_FONT_DEFAULT = 100;
export const EPUB_FONT_MIN = 70;
export const EPUB_FONT_MAX = 240;
export const EPUB_FONT_STEP = 6;

export function clampEpubFont(n: number): number {
  if (!Number.isFinite(n)) return EPUB_FONT_DEFAULT;
  return Math.max(EPUB_FONT_MIN, Math.min(EPUB_FONT_MAX, Math.round(n)));
}

/** Current font percent (falls back to the default on the server / when unset). */
export function readEpubFont(): number {
  try {
    const v = parseInt(localStorage.getItem(EPUB_FONT_KEY) ?? "", 10);
    if (Number.isFinite(v)) return clampEpubFont(v);
  } catch {
    /* storage unavailable / SSR */
  }
  return EPUB_FONT_DEFAULT;
}

/** Persist + broadcast a new size so any open reader applies it immediately. */
export function setEpubFont(pct: number): void {
  const v = clampEpubFont(pct);
  try {
    localStorage.setItem(EPUB_FONT_KEY, String(v));
  } catch {
    /* best-effort */
  }
  try {
    window.dispatchEvent(new CustomEvent(EPUB_FONT_EVENT, { detail: v }));
  } catch {
    /* best-effort */
  }
}

/* -------------------------------------------------------------------------- */
/*  Display margin (horizontal padding of the text column)                    */
/* -------------------------------------------------------------------------- */

// Horizontal margin in px. Can go NEGATIVE — negative pulls the text past the
// column edges so it hugs (or bleeds past) the window; positive insets it.
export const EPUB_MARGIN_KEY = "lp-epub-margin";
export const EPUB_MARGIN_EVENT = "lp-epub-margin";
export const EPUB_MARGIN_DEFAULT = 14;
export const EPUB_MARGIN_MIN = -48;
export const EPUB_MARGIN_MAX = 200;
export const EPUB_MARGIN_STEP = 4;

export function clampEpubMargin(n: number): number {
  if (!Number.isFinite(n)) return EPUB_MARGIN_DEFAULT;
  return Math.max(EPUB_MARGIN_MIN, Math.min(EPUB_MARGIN_MAX, Math.round(n)));
}

export function readEpubMargin(): number {
  try {
    const v = parseInt(localStorage.getItem(EPUB_MARGIN_KEY) ?? "", 10);
    if (Number.isFinite(v)) return clampEpubMargin(v);
  } catch {
    /* storage unavailable / SSR */
  }
  return EPUB_MARGIN_DEFAULT;
}

export function setEpubMargin(px: number): void {
  const v = clampEpubMargin(px);
  try {
    localStorage.setItem(EPUB_MARGIN_KEY, String(v));
  } catch {
    /* best-effort */
  }
  try {
    window.dispatchEvent(new CustomEvent(EPUB_MARGIN_EVENT, { detail: v }));
  } catch {
    /* best-effort */
  }
}

/* ---------------------------------------------------------------------- */

// Body-text alignment. Justified is the book-typography default; ragged-right
// suits narrow screens, where justification opens up rivers of white space.
export const EPUB_ALIGN_KEY = "lp-epub-align";
export const EPUB_ALIGN_EVENT = "lp-epub-align";
export type EpubAlign = "justify" | "left";
/* Ragged-right by default.
   Justified text in a phone-width column with long Indonesian words opens
   rivers of white space between words — visible on the first screen of
   "Sampai Hujan Reda" — and rivers read as effort. Readers who prefer
   justified can still switch; the setting is remembered. */
export const EPUB_ALIGN_DEFAULT: EpubAlign = "left";

export function clampEpubAlign(v: unknown): EpubAlign {
  return v === "left" || v === "justify" ? v : EPUB_ALIGN_DEFAULT;
}

export function readEpubAlign(): EpubAlign {
  try {
    return clampEpubAlign(localStorage.getItem(EPUB_ALIGN_KEY));
  } catch {
    return EPUB_ALIGN_DEFAULT;
  }
}

export function setEpubAlign(align: EpubAlign): void {
  const v = clampEpubAlign(align);
  try {
    localStorage.setItem(EPUB_ALIGN_KEY, v);
  } catch {
    /* best-effort */
  }
  try {
    window.dispatchEvent(new CustomEvent(EPUB_ALIGN_EVENT, { detail: v }));
  } catch {
    /* best-effort */
  }
}
