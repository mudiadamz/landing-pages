"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  MIN_SPLASH_MS,
  SPLASH_FADE_MS,
  getBookReady,
  getBookReadyServer,
  resetBookReady,
  subscribeBookReady,
} from "@/lib/boot-splash";

/**
 * Full-bleed cover shown while a preview loads.
 *
 * It's a client component, but an ordinary one — so it still server-renders and
 * is on screen at first paint, before any JavaScript arrives. (The reader is a
 * ssr:false dynamic import, so a splash living inside it could only appear once
 * that bundle had downloaded, by which point the book is nearly ready and the
 * cover just flashes.)
 *
 * Dismissal is React state, never DOM removal: the node belongs to React, and
 * removing it by hand broke reconciliation on client-side navigation.
 */
export function EpubBootSplash({
  coverUrl,
  thumbnailUrl,
  title,
}: {
  /** The book's own cover (see /api/epub-cover); preferred over the listing art. */
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  title?: string;
}) {
  const readyState = useSyncExternalStore(subscribeBookReady, getBookReady, getBookReadyServer);
  const [mountedAt] = useState(() => Date.now());
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  // Navigating from one preview to the next mounts a fresh splash — clear any
  // "ready" left over from the book we just came from.
  useEffect(() => {
    resetBookReady();
  }, []);

  useEffect(() => {
    if (readyState === 0 || gone) return;
    // readyState 2 means "not a book" — don't make them stare at a cover.
    const wait = readyState === 2 ? 0 : Math.max(0, MIN_SPLASH_MS - (Date.now() - mountedAt));
    const t1 = window.setTimeout(() => setFading(true), wait);
    const t2 = window.setTimeout(() => setGone(true), wait + SPLASH_FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [readyState, gone, mountedAt]);

  if (gone) return null;

  const src = coverUrl ?? thumbnailUrl;
  const wash = thumbnailUrl ?? coverUrl;

  return (
    <div id="epub-boot" className={`epub-boot epub-surface${fading ? " is-done" : ""}`} aria-hidden>
      {wash && <div className="epub-boot-wash" style={{ backgroundImage: `url(${wash})` }} />}
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            fetchPriority="high"
            decoding="sync"
            className="epub-boot-cover"
          />
          <div className="epub-boot-scrim" />
        </>
      ) : (
        title && <p className="epub-boot-title">{title}</p>
      )}
      <div className={`epub-boot-dots${src ? " epub-boot-dots--over" : ""}`}>
        <span className="epub-splash-dot" />
        <span className="epub-splash-dot" />
        <span className="epub-splash-dot" />
      </div>
    </div>
  );
}
