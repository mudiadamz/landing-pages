"use client";

// Focus/immersive mode for the preview. A tiny module-level store (no window
// events) so callers from inside reader iframes just invoke hideChrome/showChrome
// directly (those functions run in the parent realm), and the floating ornaments
// read the state via useSyncExternalStore — no event-plumbing ambiguity.

import { useSyncExternalStore } from "react";

let hidden = false;
let suppressUntil = 0;
const listeners = new Set<() => void>();

const now = () => (typeof performance !== "undefined" ? performance.now() : 0);
const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Hide the floating chrome (called on a scroll/read gesture). */
export function hideChrome(): void {
  if (now() < suppressUntil) return; // grace window (load / just-shown)
  if (!hidden) {
    hidden = true;
    emit();
  }
}

/** Show the floating chrome (called on a double-tap). */
export function showChrome(): void {
  suppressUntil = now() + 500; // don't let momentum scroll immediately re-hide
  if (hidden) {
    hidden = false;
    emit();
  }
}

/** Reset to visible with a load grace window (call when the preview mounts). */
export function resetImmersive(): void {
  suppressUntil = now() + 800;
  if (hidden) {
    hidden = false;
    emit();
  }
}

/** Whether the floating chrome is currently hidden. */
export function useChromeHidden(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hidden,
    () => false,
  );
}
