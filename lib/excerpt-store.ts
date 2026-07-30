"use client";

/**
 * What the chapter endpoint withheld, published by the reader for the gate at
 * the end of the preview.
 *
 * The page can't compute this itself. Only the server knows the full spine, and
 * making the preview page unzip the book to count chapters would put an archive
 * read on the critical path of the one page that must stay fast. The reader
 * already fetches the chapters, so the counts ride along on that response and
 * are republished here.
 *
 * Same shape as lib/boot-splash.ts, and for the same reason: never reach into
 * React-owned DOM to update a sibling, signal through a store instead.
 */

export type ExcerptMeta = {
  shownChapters: number;
  totalChapters: number;
  shownChars: number;
  totalChars: number;
};

let meta: ExcerptMeta | null = null;
const listeners = new Set<() => void>();

export function setExcerptMeta(next: ExcerptMeta | null): void {
  // Compare by value: the reader re-publishes on every load, and handing
  // useSyncExternalStore a fresh object each time would loop forever.
  const same =
    (meta === null && next === null) ||
    (!!meta &&
      !!next &&
      meta.shownChapters === next.shownChapters &&
      meta.totalChapters === next.totalChapters &&
      meta.shownChars === next.shownChars &&
      meta.totalChars === next.totalChars);
  if (same) return;
  meta = next;
  for (const fn of listeners) fn();
}

export function subscribeExcerptMeta(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getExcerptMeta(): ExcerptMeta | null {
  return meta;
}

/** Nothing has loaded during SSR, so the gate renders its static copy first. */
export function getExcerptMetaServer(): ExcerptMeta | null {
  return null;
}

/** Remaining reading time, in minutes. */
export function minutesLeft(m: ExcerptMeta): number {
  // ~1500 visible characters per minute: roughly 220 wpm at the ~6.8 characters
  // an Indonesian word averages including its space. Rounded to 5-minute steps
  // because a precise-looking "37 menit" invites an argument the number can't win.
  const mins = Math.max(0, m.totalChars - m.shownChars) / 1500;
  if (mins < 5) return Math.max(1, Math.round(mins));
  return Math.round(mins / 5) * 5;
}

export function percentShown(m: ExcerptMeta): number {
  if (m.totalChars <= 0) return 0;
  return Math.max(1, Math.min(99, Math.round((m.shownChars / m.totalChars) * 100)));
}
