"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getSessionId, detectClient } from "@/lib/track";
import {
  getVisitorId,
  getSessionEntry,
  pageType,
  productSlugFromPath,
  sendJourney,
  reportEngagedRead,
  type JourneyEntry,
} from "@/lib/journey";

/** Active time on a preview that counts as a genuine read (mirrors the server). */
const READ_THRESHOLD_MS = 30_000;

/**
 * Tracks the visitor's journey across the whole app: one page_event per page
 * visit (path, dwell, scroll depth), plus session-level entry/referrer/UTM.
 * Mounted once in the root layout. Uses only usePathname() (no useSearchParams)
 * so it doesn't force pages to be dynamic — UTM is read from location.search in
 * getSessionEntry (once per session).
 */
type PageTrack = {
  path: string;
  productSlug: string | null;
  kind: string;
  activeMs: number;
  lastResume: number | null; // ms timestamp while visible, else null
  maxScroll: number | null; // 0..1, or null while depth is still unknown
  reachedEnd: boolean;
  sent: boolean;
};

/**
 * A page that isn't scrollable yet tells us nothing: async content (the EPUB
 * reader, embedded viewers) injects after mount, so an early measurement would
 * score "100% read" on what is really a blank screen. Treat non-scrollable as
 * unknown until the page has had time to settle; only then is a short page
 * genuinely fully-seen.
 */
const SETTLE_MS = 4000;

export function SessionTracker() {
  const pathname = usePathname();
  const idsRef = useRef<{ sessionId: string; visitorId: string; entry: JourneyEntry } | null>(null);

  useEffect(() => {
    if (!idsRef.current) {
      idsRef.current = {
        sessionId: getSessionId(),
        visitorId: getVisitorId(),
        entry: getSessionEntry(),
      };
    }
    const ids = idsRef.current;
    const now = () => Date.now();

    const page: PageTrack = {
      path: pathname,
      productSlug: productSlugFromPath(pathname),
      kind: pageType(pathname),
      activeMs: 0,
      lastResume: document.visibilityState === "visible" ? now() : null,
      maxScroll: null,
      reachedEnd: false,
      sent: false,
    };
    const mountedAt = now();

    const accrue = () => {
      if (page.lastResume != null) {
        page.activeMs += now() - page.lastResume;
        page.lastResume = now();
      }
    };

    // Once someone has genuinely read, tell Meta — it's the only signal that can
    // steer delivery toward readers rather than whoever taps most cheaply.
    let readReported = false;
    const checkRead = () => {
      if (readReported || page.kind !== "preview" || !page.productSlug) return;
      accrue();
      if (page.activeMs < READ_THRESHOLD_MS) return;
      readReported = true;
      reportEngagedRead(page.productSlug, page.activeMs / 1000);
    };
    const readTimer = window.setInterval(checkRead, 5000);

    const measureScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) {
        // Not scrollable: only trust it once the page has settled.
        if (now() - mountedAt >= SETTLE_MS) {
          page.maxScroll = 1;
          page.reachedEnd = true;
        }
        return;
      }
      const depth = Math.min(1, Math.max(0, window.scrollY / scrollable));
      if (page.maxScroll === null || depth > page.maxScroll) page.maxScroll = depth;
      if (depth >= 0.98) page.reachedEnd = true;
    };

    const flush = (beacon: boolean) => {
      accrue();
      if (page.sent) return;
      page.sent = true;
      const { device, browser, os } = detectClient();
      sendJourney(
        {
          sessionId: ids.sessionId,
          visitorId: ids.visitorId,
          entry: ids.entry,
          path: page.path,
          pageType: page.kind,
          productSlug: page.productSlug,
          dwellMs: Math.round(page.activeMs),
          scrollDepth: page.maxScroll === null ? null : Math.round(page.maxScroll * 100),
          reachedEnd: page.reachedEnd,
          device,
          browser,
          os,
        },
        beacon,
      );
    };

    const onScroll = () => measureScroll();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        accrue();
        checkRead();
        page.lastResume = null;
        flush(true); // mobile-safe: tab backgrounding is often the last signal
      } else {
        page.lastResume = now();
      }
    };
    const onPageHide = () => flush(true);

    measureScroll();
    // Re-check once async content has had time to render, so a genuinely short
    // page still records as fully seen even if the reader never scrolls.
    const settleTimer = window.setTimeout(measureScroll, SETTLE_MS + 100);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      // SPA route change → record the page we're leaving.
      window.clearTimeout(settleTimer);
      window.clearInterval(readTimer);
      checkRead();
      flush(false);
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [pathname]);

  return null;
}
