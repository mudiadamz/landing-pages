"use client";

// Focus/immersive mode for the preview. A tiny module-level store (no window
// events) so callers from inside reader iframes just invoke hideChrome/showChrome
// directly (those functions run in the parent realm), and the floating ornaments
// read the state via useSyncExternalStore — no event-plumbing ambiguity.

import { useSyncExternalStore } from "react";

let hidden = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Hide the floating chrome. */
export function hideChrome(): void {
  if (!hidden) {
    hidden = true;
    emit();
  }
}

/** Show the floating chrome. */
export function showChrome(): void {
  if (hidden) {
    hidden = false;
    emit();
  }
}

/** Reset to visible (call when the preview mounts). */
export function resetImmersive(): void {
  showChrome();
}

/** Whether the floating chrome is currently hidden. */
export function useChromeHidden(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hidden,
    () => false,
  );
}
