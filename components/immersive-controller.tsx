"use client";

import { useEffect } from "react";
import { hideChrome, showChrome, resetImmersive, useChromeHidden } from "@/lib/immersive";

type TawkApi = { hideWidget?: () => void; showWidget?: () => void };
const getTawk = () => (window as Window & { Tawk_API?: TawkApi }).Tawk_API;

/**
 * Focus mode on the preview: visible on load, a scroll/read gesture hides the
 * floating chrome, a double-tap shows it again. Handles page-level gestures (PDF
 * canvases, margins) and forwarded signals; the EPUB reader calls hide/show
 * directly. Renders nothing.
 */
export function ImmersiveController() {
  const hidden = useChromeHidden();

  // Third-party chat widgets (e.g. Tawk) live at the document root, outside
  // React, so they don't fade with the rest of the chrome — drive them via
  // their API so they respect focus mode. Retries while the widget loads.
  useEffect(() => {
    const apply = () => {
      const api = getTawk();
      if (!api || typeof api.hideWidget !== "function") return false;
      if (hidden) api.hideWidget();
      else api.showWidget?.();
      return true;
    };
    if (apply()) return;
    let tries = 0;
    const id = window.setInterval(() => {
      if (apply() || ++tries > 20) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
  }, [hidden]);

  // Restore the widget when leaving the reader.
  useEffect(() => () => getTawk()?.showWidget?.(), []);

  useEffect(() => {
    resetImmersive();

    const onScroll = () => hideChrome();
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { __lpPreview?: unknown; scrolled?: unknown } | null;
      if (d && typeof d === "object" && d.__lpPreview && d.scrolled) hideChrome();
    };
    // Manual double-tap (touch-friendly) — two taps within 350ms show the chrome.
    let lastTapAt = 0;
    const onTap = () => {
      const t = Date.now();
      if (t - lastTapAt < 350) {
        lastTapAt = 0;
        showChrome();
      } else {
        lastTapAt = t;
      }
    };

    document.addEventListener("wheel", onScroll, { passive: true });
    document.addEventListener("touchmove", onScroll, { passive: true });
    // Capture phase catches scroll on any element (scroll doesn't bubble).
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("lp-preview-scroll", onScroll);
    window.addEventListener("message", onMessage);
    document.addEventListener("click", onTap);

    return () => {
      document.removeEventListener("wheel", onScroll);
      document.removeEventListener("touchmove", onScroll);
      document.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener("lp-preview-scroll", onScroll);
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onTap);
    };
  }, []);

  return null;
}
