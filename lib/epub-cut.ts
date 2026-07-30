/**
 * How much of a book the free preview shows.
 *
 * There is ONE file. The preview and the buyer's download are the same EPUB, and
 * the cut is applied when chapters are served, not by building a second archive.
 * That is a deliberate reversal of the obvious design: a generated preview file
 * works, but it means every typo has to be fixed twice and the two copies drift
 * the moment someone forgets. One file cannot drift from itself.
 *
 * The truncation happens SERVER-SIDE, in the chapter endpoint. The withheld
 * chapters are never sent to the browser — this is not a reader that has the
 * whole book and politely stops. See app/api/epub-text/[slug]/route.ts.
 */

export const DEFAULT_CUT_PERCENT = 60;
export const MIN_CUT_PERCENT = 5;
export const MAX_CUT_PERCENT = 95;

export function clampCutPercent(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return DEFAULT_CUT_PERCENT;
  return Math.min(MAX_CUT_PERCENT, Math.max(MIN_CUT_PERCENT, n));
}

/**
 * How many leading chapters to keep so that `100 - cutPercent`% of the prose is
 * visible.
 *
 * Measured in characters, not chapters. Chapters are not equal — front matter, a
 * dedication and a 4000-word chapter are one spine entry each, so "keep 40% of
 * the chapters" hands out wildly different amounts of real reading depending on
 * where the short ones sit. Characters are what a reader spends.
 *
 * The cut still lands on a chapter boundary: a preview that stops mid-sentence
 * reads as a bug, not a cliffhanger. The chapter that crosses the threshold is
 * kept whole, so the excerpt is never shorter than asked — only up to one
 * chapter longer. The last chapter is always withheld, so a book can never
 * accidentally be given away in full.
 */
export function keepCountForCut(charCounts: number[], cutPercent: number): number {
  const total = charCounts.reduce((a, b) => a + b, 0);
  if (charCounts.length === 0) return 0;
  if (total === 0) return Math.max(1, charCounts.length - 1);

  const target = total * ((100 - clampCutPercent(cutPercent)) / 100);
  let acc = 0;
  let keep = 0;
  for (let i = 0; i < charCounts.length; i++) {
    keep = i + 1;
    acc += charCounts[i];
    if (acc >= target) break;
  }
  return Math.max(1, Math.min(keep, charCounts.length - 1));
}

/** Visible-character count of a chapter's HTML, matching keepCountForCut's unit. */
export function visibleChars(html: string): number {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}
