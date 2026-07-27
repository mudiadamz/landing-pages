"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getBookReady,
  getBookReadyServer,
  subscribeBookReady,
} from "@/lib/boot-splash";
import {
  getScrolled,
  getScrolledServer,
  resetFirstScroll,
  subscribeFirstScroll,
} from "@/lib/first-scroll";
import { trackFirstScroll } from "@/lib/track";

/**
 * Two affordances for the first screen of a read, plus the telemetry that says
 * whether they worked.
 *
 * The reader is a plain scrolling document with no visible scrollbar, and ~66% of
 * ad traffic arrives in Instagram's in-app Android webview — so nothing on screen
 * tells a visitor that the text continues below the fold. This adds:
 *
 *  1. a soft fade at the bottom edge, so the last visible line dissolves instead
 *     of ending flat (a hard cut reads as "that's all there is");
 *  2. a chevron that appears with the text, pulses a few times, and never comes
 *     back once they scroll.
 *
 * The chevron shows immediately rather than waiting for the visitor to stall.
 * Median dwell on this page is 1.6s, so a hint held back for an idle beat would
 * have arrived after most of the audience had already gone — the gesture has to be
 * suggested while there is still someone to suggest it to. It still retires on its
 * own after a few pulses, so it can't settle into being furniture.
 *
 * Nothing here can delay the words: it mounts after the reader signals ready, and
 * the whole component renders nothing at all until then. That ordering is not
 * cosmetic — a 1.1s cover hold used to cost 48% of paid visitors the first
 * sentence, and this must never repeat it.
 */

/** Pulse, then stop nagging — three beats is plenty (see CSS animation). */
const HINT_LIFE_MS = 6000;
/** Below this much off-screen content there's nothing worth pointing at. */
const MIN_OVERFLOW_PX = 24;

export function ReaderScrollHint({ slug }: { slug: string }) {
  const ready = useSyncExternalStore(subscribeBookReady, getBookReady, getBookReadyServer);
  const scrolled = useSyncExternalStore(subscribeFirstScroll, getScrolled, getScrolledServer);
  const readyAtRef = useRef<number | null>(null);
  const [spent, setSpent] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  // Navigating preview → preview reuses this component; the next book gets a
  // fresh first scroll (mirrors resetBookReady in EpubBootSplash).
  useEffect(() => {
    resetFirstScroll();
    readyAtRef.current = null;
  }, [slug]);

  // The clock starts when the text is on screen, not when the route mounted —
  // the number we want is "how long after seeing words did they move". Kept in a
  // ref, not state: the value is only ever read from inside later effects, and
  // `ready` flipping already re-renders us. Declared before the effects that read
  // it, since effects run in order.
  useEffect(() => {
    if (ready !== 0 && readyAtRef.current === null) readyAtRef.current = Date.now();
  }, [ready]);

  // Is there anything below the fold? Re-checked on resize because the in-app
  // browser's chrome collapses and changes the viewport after load.
  useEffect(() => {
    if (ready === 0) return;
    const check = () =>
      setScrollable(
        document.documentElement.scrollHeight - window.innerHeight > MIN_OVERFLOW_PX,
      );
    // One frame later: the chapter HTML has just been injected, so let layout settle.
    const raf = requestAnimationFrame(check);
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", check);
    };
  }, [ready]);

  // Report the first scroll once, with the time it took.
  useEffect(() => {
    const readyAt = readyAtRef.current;
    if (!scrolled || readyAt === null) return;
    trackFirstScroll(slug, "preview", Date.now() - readyAt);
  }, [scrolled, slug]);

  // The chevron shows as soon as there's something to point at; this only sets
  // the moment it gives up. Any scroll retires it too, for good (the first-scroll
  // store never un-sets itself).
  useEffect(() => {
    if (ready === 0 || scrolled || !scrollable) return;
    const done = window.setTimeout(() => setSpent(true), HINT_LIFE_MS);
    return () => window.clearTimeout(done);
  }, [ready, scrolled, scrollable]);

  if (ready === 0 || !scrollable || scrolled) return null;

  return (
    <>
      <div className="reader-fade" aria-hidden />
      {!spent && (
        <div className="reader-scroll-hint" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </>
  );
}
