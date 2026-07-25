"use client";

// Focus/immersive mode for the preview: the floating chrome (⋯ menu, buy bar,
// etc.) auto-hides so the reader can focus on the text, and a double-tap toggles
// it back. The controller owns the state + timer and broadcasts it; consumers
// read it via useChromeHidden(). Double-taps from inside reader iframes are
// forwarded with dispatchImmersiveTap().

import { useEffect, useState } from "react";

export const IMMERSIVE_STATE_EVENT = "lp-immersive-state"; // detail: { hidden: boolean }
export const IMMERSIVE_TAP_EVENT = "lp-immersive-tap";
export const IMMERSIVE_SCROLL_EVENT = "lp-immersive-scroll";

/** Forward a double-tap (e.g. from inside an EPUB iframe) to the controller. */
export function dispatchImmersiveTap(): void {
  try {
    window.dispatchEvent(new CustomEvent(IMMERSIVE_TAP_EVENT));
  } catch {
    /* best-effort */
  }
}

/** Signal a scroll/read gesture (e.g. from inside an iframe) — hides the chrome. */
export function dispatchImmersiveScroll(): void {
  try {
    window.dispatchEvent(new CustomEvent(IMMERSIVE_SCROLL_EVENT));
  } catch {
    /* best-effort */
  }
}

/** Whether the floating chrome is currently hidden (updates on broadcasts). */
export function useChromeHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onState = (e: Event) => setHidden(!!(e as CustomEvent).detail?.hidden);
    window.addEventListener(IMMERSIVE_STATE_EVENT, onState);
    return () => window.removeEventListener(IMMERSIVE_STATE_EVENT, onState);
  }, []);
  return hidden;
}
