"use client";

import { useEffect } from "react";
import { IMMERSIVE_STATE_EVENT, IMMERSIVE_TAP_EVENT } from "@/lib/immersive";

const HIDE_MS = 4000;

/**
 * Drives focus mode on the preview: starts with the chrome visible, auto-hides
 * it after a few idle seconds, and toggles it on double-tap (from the page or
 * forwarded from a reader iframe). Renders nothing — it only broadcasts state.
 */
export function ImmersiveController() {
  useEffect(() => {
    let hidden = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const broadcast = () =>
      window.dispatchEvent(new CustomEvent(IMMERSIVE_STATE_EVENT, { detail: { hidden } }));
    const set = (v: boolean) => {
      if (hidden !== v) {
        hidden = v;
        broadcast();
      }
    };
    const scheduleHide = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => set(true), HIDE_MS);
    };
    const reveal = () => {
      set(false);
      scheduleHide();
    };
    const toggle = () => {
      if (hidden) reveal();
      else {
        if (timer) clearTimeout(timer);
        set(true);
      }
    };
    // Interaction while visible keeps the chrome alive; while hidden it stays
    // hidden (so reading isn't interrupted — only a double-tap brings it back).
    const keepAlive = () => {
      if (!hidden) scheduleHide();
    };

    broadcast();
    scheduleHide();

    window.addEventListener(IMMERSIVE_TAP_EVENT, toggle);
    document.addEventListener("dblclick", toggle);
    document.addEventListener("pointermove", keepAlive, { passive: true });
    document.addEventListener("pointerdown", keepAlive, { passive: true });
    document.addEventListener("keydown", reveal);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(IMMERSIVE_TAP_EVENT, toggle);
      document.removeEventListener("dblclick", toggle);
      document.removeEventListener("pointermove", keepAlive);
      document.removeEventListener("pointerdown", keepAlive);
      document.removeEventListener("keydown", reveal);
    };
  }, []);

  return null;
}
