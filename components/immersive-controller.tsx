"use client";

import { useEffect } from "react";
import {
  IMMERSIVE_SCROLL_EVENT,
  IMMERSIVE_STATE_EVENT,
  IMMERSIVE_TAP_EVENT,
} from "@/lib/immersive";

/**
 * Focus mode on the preview: everything starts visible; the first scroll/read
 * gesture hides the floating chrome so the reader can focus on the text, and a
 * double-tap brings it back (until the next scroll hides it again). Renders
 * nothing — it only broadcasts the hidden state.
 */
export function ImmersiveController() {
  useEffect(() => {
    let hidden = false;
    // Ignore scroll-hide during a short grace window: on load (so epub.js's
    // initial layout / saved-position restore doesn't hide the chrome), and
    // right after a double-tap (so momentum scroll doesn't instantly re-hide).
    let suppressHideUntil = performance.now() + 800;

    const broadcast = () =>
      window.dispatchEvent(new CustomEvent(IMMERSIVE_STATE_EVENT, { detail: { hidden } }));
    const set = (v: boolean) => {
      if (hidden !== v) {
        hidden = v;
        broadcast();
      }
    };
    const show = () => {
      suppressHideUntil = performance.now() + 500;
      set(false);
    };
    const hide = () => {
      if (performance.now() < suppressHideUntil) return;
      set(true);
    };

    // Start visible.
    broadcast();

    // Hide on any scroll/read gesture (parent doc + forwarded from iframes).
    const onScroll = () => hide();
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { __lpPreview?: unknown; scrolled?: unknown } | null;
      if (d && typeof d === "object" && d.__lpPreview && d.scrolled) hide();
    };
    // Show on double-tap (page dblclick + forwarded from iframes).
    const onShow = () => show();

    window.addEventListener(IMMERSIVE_SCROLL_EVENT, onScroll);
    window.addEventListener("lp-preview-scroll", onScroll);
    window.addEventListener("message", onMessage);
    document.addEventListener("wheel", onScroll, { passive: true });
    document.addEventListener("touchmove", onScroll, { passive: true });
    // Capture phase catches scroll on ANY element (scroll doesn't bubble) — this
    // is what reliably picks up epub.js's own scroll container, which lives in
    // the parent DOM but never reaches a window-level scroll listener.
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener(IMMERSIVE_TAP_EVENT, onShow);
    document.addEventListener("dblclick", onShow);

    return () => {
      window.removeEventListener(IMMERSIVE_SCROLL_EVENT, onScroll);
      window.removeEventListener("lp-preview-scroll", onScroll);
      window.removeEventListener("message", onMessage);
      document.removeEventListener("wheel", onScroll);
      document.removeEventListener("touchmove", onScroll);
      document.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener(IMMERSIVE_TAP_EVENT, onShow);
      document.removeEventListener("dblclick", onShow);
    };
  }, []);

  return null;
}
