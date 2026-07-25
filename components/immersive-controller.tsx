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
    // A short grace window after showing, so momentum/stray scroll right after a
    // double-tap doesn't immediately hide the chrome again.
    let suppressHideUntil = 0;

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
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener(IMMERSIVE_TAP_EVENT, onShow);
    document.addEventListener("dblclick", onShow);

    return () => {
      window.removeEventListener(IMMERSIVE_SCROLL_EVENT, onScroll);
      window.removeEventListener("lp-preview-scroll", onScroll);
      window.removeEventListener("message", onMessage);
      document.removeEventListener("wheel", onScroll);
      document.removeEventListener("touchmove", onScroll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener(IMMERSIVE_TAP_EVENT, onShow);
      document.removeEventListener("dblclick", onShow);
    };
  }, []);

  return null;
}
