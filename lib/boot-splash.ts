"use client";

/**
 * Tiny store telling the cover splash when the book behind it is ready.
 *
 * This used to dismiss the splash by calling .remove() on its DOM node — but
 * that node is rendered by React, so tearing it out from underneath React
 * crashed reconciliation on the next client-side navigation ("child node
 * undefined"). Never mutate React-owned nodes; signal through state instead.
 */

export const SPLASH_FADE_MS = 400;

/**
 * Hold the cover for at least this long after the splash mounts. The book can
 * be ready in a few hundred ms, and a cover that vanishes the instant it
 * appears reads as a flicker rather than a title card.
 */
export const MIN_SPLASH_MS = 1100;

/**
 * 0 = still loading · 1 = ready (hold the cover for MIN_SPLASH_MS) · 2 = ready,
 * drop it now. Encoded as a number because useSyncExternalStore needs a stable
 * snapshot — returning a fresh object each read would loop forever.
 */
export type BookReadyState = 0 | 1 | 2;

let state: BookReadyState = 0;
const listeners = new Set<() => void>();

function set(next: BookReadyState) {
  if (state === next) return;
  state = next;
  for (const fn of listeners) fn();
}

/**
 * The preview behind the splash is on screen — let the cover retire.
 * `immediate` skips the minimum hold, for previews that own their own loading
 * UI and shouldn't sit behind a book cover at all.
 */
export function markBookReady(immediate = false): void {
  set(immediate ? 2 : 1);
}

/** A new preview is mounting; its cover should show again. */
export function resetBookReady(): void {
  set(0);
}

export function subscribeBookReady(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getBookReady(): BookReadyState {
  return state;
}

/** Server render always shows the cover — nothing has loaded yet. */
export function getBookReadyServer(): BookReadyState {
  return 0;
}
