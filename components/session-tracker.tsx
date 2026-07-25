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
  type JourneyEntry,
} from "@/lib/journey";

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
  maxScroll: number; // 0..1
  reachedEnd: boolean;
  sent: boolean;
};

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
      maxScroll: 0,
      reachedEnd: false,
      sent: false,
    };

    const accrue = () => {
      if (page.lastResume != null) {
        page.activeMs += now() - page.lastResume;
        page.lastResume = now();
      }
    };

    const measureScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const depth = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 1;
      if (depth > page.maxScroll) page.maxScroll = depth;
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
          scrollDepth: Math.round(page.maxScroll * 100),
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
        page.lastResume = null;
        flush(true); // mobile-safe: tab backgrounding is often the last signal
      } else {
        page.lastResume = now();
      }
    };
    const onPageHide = () => flush(true);

    measureScroll();
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      // SPA route change → record the page we're leaving.
      flush(false);
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [pathname]);

  return null;
}
