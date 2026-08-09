// Shared EPUB reader font-size state. The control lives in the actions ("⋯")
// menu, while the reader (EpubViewer) is a separate component — they sync via a
// window CustomEvent plus a persisted localStorage value (so the choice sticks
// across books/sessions). Both are SSR-safe (guarded reads).

// Font size as a percent of EPUB_FONT_BASE_PX.
export const EPUB_FONT_KEY = "lp-epub-font";
export const EPUB_FONT_EVENT = "lp-epub-font";

/**
 * Base body size, in px, that 100% means.
 *
 * Rebased twice, both times for the same reason: the size people actually read
 * at should be the one the readout calls 100%, so nobody has to discover it.
 * 19 → 21.28 (×1.12), then 21.28 → 26.6 (×1.25).
 */
export const EPUB_FONT_BASE_PX = 26.6;

/**
 * Distance from each older base to the current one, used only to migrate saved
 * choices. Which one applies is decided by the stamp: a value stamped "2" was
 * already rebased onto 21.28 and has only the second hop left, while an unstamped
 * one predates both and has to travel the whole way (1.12 × 1.25 = 1.4).
 *
 * Applying a single factor to both would shrink the stamped values twice.
 */
const REBASE_FROM_19 = 1.4;
const REBASE_FROM_21 = 1.25;

/**
 * A reader who had saved "112%" means a SIZE, not a number. After the rebase that
 * same number would render 12% bigger than what they chose, so stored values are
 * rescaled once and stamped, rather than silently reinterpreted.
 */
const EPUB_FONT_SCALE_KEY = "lp-epub-font-scale";
const EPUB_FONT_SCALE_VERSION = "3";
/** The stamp written by the previous rebase — its values sit on the 21.28 base. */
const EPUB_FONT_SCALE_V2 = "2";

export const EPUB_FONT_DEFAULT = 100;
/**
 * The floor is rebased with the base, not left at 70.
 *
 * Percentages are relative, so raising the base shrinks what the old numbers can
 * reach: 70% of 26.6 is 18.6px, well above the 14.9px the old 70% gave. Left
 * alone, the smallest text in the reader would silently become bigger than it
 * was, and the migration would clamp anyone who had chosen it back up — taking
 * away a size they had picked deliberately. 56% of 26.6 is that same 14.9px.
 */
export const EPUB_FONT_MIN = 56;
export const EPUB_FONT_MAX = 240;
export const EPUB_FONT_STEP = 6;

export function clampEpubFont(n: number): number {
  if (!Number.isFinite(n)) return EPUB_FONT_DEFAULT;
  return Math.max(EPUB_FONT_MIN, Math.min(EPUB_FONT_MAX, Math.round(n)));
}

/** Current font percent (falls back to the default on the server / when unset). */
export function readEpubFont(): number {
  try {
    const raw = localStorage.getItem(EPUB_FONT_KEY);
    if (raw === null) return EPUB_FONT_DEFAULT;

    const stored = parseInt(raw, 10);
    if (!Number.isFinite(stored)) {
      // Real value found in the wild: "large", left over from when this setting was
      // a keyword rather than a percent. It already fell through to the default, but
      // it also sat there forever and left the migration stamp unwritten. Replace it
      // so the persisted state matches what the reader is actually showing.
      localStorage.setItem(EPUB_FONT_KEY, String(EPUB_FONT_DEFAULT));
      localStorage.setItem(EPUB_FONT_SCALE_KEY, EPUB_FONT_SCALE_VERSION);
      return EPUB_FONT_DEFAULT;
    }

    // Written against an older base? Convert to the same physical size on the new
    // one, then stamp so it happens exactly once. How far it travels depends on
    // where it started, which is exactly what the old stamp records.
    const stamp = localStorage.getItem(EPUB_FONT_SCALE_KEY);
    if (stamp !== EPUB_FONT_SCALE_VERSION) {
      const factor = stamp === EPUB_FONT_SCALE_V2 ? REBASE_FROM_21 : REBASE_FROM_19;
      const migrated = clampEpubFont(stored / factor);
      localStorage.setItem(EPUB_FONT_KEY, String(migrated));
      localStorage.setItem(EPUB_FONT_SCALE_KEY, EPUB_FONT_SCALE_VERSION);
      return migrated;
    }
    return clampEpubFont(stored);
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
    // Anything written now is already on the new base; stamp it so the migration
    // above can never run over a fresh value.
    localStorage.setItem(EPUB_FONT_SCALE_KEY, EPUB_FONT_SCALE_VERSION);
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
export const EPUB_MARGIN_DEFAULT = 10;
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
/* Justified by default — the book-typography convention, and what Adam wants a
   reader to open to.
   The known cost: a phone-width column of long Indonesian words opens rivers of
   white space between them (visible on the first screen of "Sampai Hujan Reda").
   Ragged-right remains one tap away and the choice is remembered, so the reader
   who is bothered by rivers fixes it once. */
export const EPUB_ALIGN_DEFAULT: EpubAlign = "justify";

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
