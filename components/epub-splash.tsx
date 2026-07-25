"use client";

import { useEffect, useState } from "react";

/**
 * Cover splash shown while a book loads. The thumbnail is usually already in
 * cache from the grid the reader tapped, so it paints instantly and the preview
 * feels like opening a book rather than watching a spinner. Held for a moment
 * even on a fast load so it reads as intentional instead of flashing.
 */
const MIN_VISIBLE_MS = 550;
const FADE_MS = 400;

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
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mounted));
    const t1 = window.setTimeout(() => setFading(true), wait);
    const t2 = window.setTimeout(() => setGone(true), wait + FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [ready, gone, mounted]);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className="epub-surface fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden px-8"
      style={{
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* Blurred wash of the cover so the screen isn't a flat slab of colour. */}
      {thumbnailUrl && (
        <div
          className="absolute inset-0 scale-125 opacity-25 blur-2xl"
          style={{
            backgroundImage: `url(${thumbnailUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      <div className="relative flex flex-col items-center">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            fetchPriority="high"
            className="max-h-[46vh] w-auto max-w-[68vw] rounded-xl object-contain shadow-2xl ring-1 ring-black/10"
            style={{
              animation: `epub-splash-in ${FADE_MS}ms ease-out both`,
            }}
          />
        ) : (
          title && <p className="max-w-sm text-center text-lg font-semibold">{title}</p>
        )}

        <div className="mt-7 flex items-center gap-1.5" role="status" aria-label="Memuat">
          <span className="epub-splash-dot h-1.5 w-1.5 rounded-full bg-current opacity-40" />
          <span className="epub-splash-dot h-1.5 w-1.5 rounded-full bg-current opacity-40" />
          <span className="epub-splash-dot h-1.5 w-1.5 rounded-full bg-current opacity-40" />
        </div>
      </div>
    </div>
  );
}
