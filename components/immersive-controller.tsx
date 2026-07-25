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

    // Scroll hides the chrome after a short delay (so a quick scroll doesn't
    // snatch the tools away instantly); a single tap shows them again.
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleHide = () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(hideChrome, 1000);
    };
    const show = () => {
      if (hideTimer) clearTimeout(hideTimer);
      showChrome();
    };

    const onScroll = () => scheduleHide();
    const onTap = () => show();
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { __lpPreview?: unknown; scrolled?: unknown } | null;
      if (d && typeof d === "object" && d.__lpPreview && d.scrolled) scheduleHide();
    };

    document.addEventListener("wheel", onScroll, { passive: true });
    document.addEventListener("touchmove", onScroll, { passive: true });
    // Capture phase catches scroll on any element (scroll doesn't bubble).
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("lp-preview-scroll", onScroll);
    window.addEventListener("message", onMessage);
    document.addEventListener("click", onTap);

    return () => {
      if (hideTimer) clearTimeout(hideTimer);
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
