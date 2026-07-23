"use client";

import { useEffect } from "react";
import {
  detectClient,
  getSessionId,
  referrerHost,
  sendTrack,
  type TrackPage,
} from "@/lib/track";

/**
 * Records a product page view (with device / browser / OS / referrer) once per
 * session, and reports how long the visitor actively spent on the page. Active
 * time only accrues while the tab is visible; it's flushed (via sendBeacon) each
 * time the page is hidden or unloaded, so multiple visits within one session sum
 * to the total time spent.
 */
export function ProductTracker({ slug, page }: { slug: string; page: TrackPage }) {
  useEffect(() => {
    const sessionId = getSessionId();
    const { device, browser, os } = detectClient();

    // One view per session per page (preview / checkout counted separately).
    try {
      const key = `lp-tracked:${page}:${slug}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        sendTrack({
          slug,
          sessionId,
          kind: "view",
          page,
          referrerHost: referrerHost(),
          device,
          browser,
          os,
        });
      }
    } catch {
      /* ignore storage errors */
    }

    // Active-time accounting.
    let activeMs = 0;
    let lastStart = Date.now();
    let visible = typeof document !== "undefined" ? !document.hidden : true;

    const accrue = () => {
      const now = Date.now();
      if (visible) activeMs += now - lastStart;
      lastStart = now;
    };

    const flush = (beacon: boolean) => {
      accrue();
      if (activeMs >= 1000) {
        sendTrack(
          { slug, sessionId, kind: "session", page, durationMs: activeMs, device, browser, os },
          beacon,
        );
        activeMs = 0;
      }
    };

    const onVisibility = () => {
      accrue();
      visible = !document.hidden;
      lastStart = Date.now();
      if (document.hidden) flush(true);
    };
    const onPageHide = () => flush(true);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flush(false);
    };
  }, [slug, page]);

  return null;
}
