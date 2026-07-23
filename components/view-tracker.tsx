"use client";

import { useEffect } from "react";
import { incrementLandingView } from "@/lib/actions/landing-pages";

/**
 * Fires a single view increment per browser session for a product. The
 * session-storage guard keeps refreshes / navigating between the preview and
 * checkout of the same product from inflating the count. Best-effort — silent on
 * failure.
 */
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `lp-viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode — fall through and just count it */
    }
    void incrementLandingView(slug);
  }, [slug]);

  return null;
}
