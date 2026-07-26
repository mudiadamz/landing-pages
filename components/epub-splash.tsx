"use client";

import { useEffect, useState } from "react";
import { MIN_SPLASH_MS, SPLASH_FADE_MS } from "@/lib/boot-splash";

/**
 * Client-side twin of EpubBootSplash, for readers opened where there's no
 * server-rendered shell to carry a splash — the purchased-book modal. Shares
 * the same .epub-boot-* styles so the two look identical.
 *
 * On the /lp preview the server-rendered splash is used instead; see
 * EpubBootSplash for why that one can't be a client component.
 */
export function EpubSplash({
  thumbnailUrl,
  title,
  ready,
}: {
  thumbnailUrl?: string | null;
  title?: string;
  /** Book content has been injected — start dismissing. */
  ready: boolean;
}) {
  const [mounted] = useState(() => Date.now());
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready || gone) return;
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - mounted));
    const t1 = window.setTimeout(() => setFading(true), wait);
    const t2 = window.setTimeout(() => setGone(true), wait + SPLASH_FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [ready, gone, mounted]);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className={`epub-boot epub-surface${fading ? " is-done" : ""}`}
      style={{ animation: "none" }}
    >
      {thumbnailUrl && (
        <div className="epub-boot-wash" style={{ backgroundImage: `url(${thumbnailUrl})` }} />
      )}
      {thumbnailUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt=""
            fetchPriority="high"
            className="epub-boot-cover"
          />
          <div className="epub-boot-scrim" />
        </>
      ) : (
        title && <p className="epub-boot-title">{title}</p>
      )}
      <div className={`epub-boot-dots${thumbnailUrl ? " epub-boot-dots--over" : ""}`}>
        <span className="epub-splash-dot" />
        <span className="epub-splash-dot" />
        <span className="epub-splash-dot" />
      </div>
    </div>
  );
}
