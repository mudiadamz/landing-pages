"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getScrolled, getScrolledServer, subscribeFirstScroll } from "@/lib/first-scroll";
import { useChromeHidden } from "@/lib/immersive";

/**
 * Quiet "3/50" readout at the bottom of a preview, in the space the floating buy
 * CTA used to occupy.
 *
 * It replaces that CTA deliberately: the only purchase prompt now lives at the
 * end of the read (see ReaderEndPanel), so nothing interrupts the reading. What a
 * reader actually wants at the bottom edge is their place in the text, which is
 * also a reason to keep going — a visible denominator makes the remaining
 * distance feel finite.
 *
 * Visibility follows the floating chrome exactly — the same `useChromeHidden`
 * store that drives the back arrow and the actions menu, so all three fade
 * together ~850ms into a scroll and all three return on a tap. The reader gets
 * one uninterrupted surface while moving, and one consistent set of controls when
 * they ask for it; a readout that lingered after its neighbours left would just
 * look like a bug.
 *
 * Two sources, because the three preview kinds scroll in different places:
 *  • "window" — the inline EPUB reader flows in the document, so it is measured
 *    here, in screenfuls of the book's own content (a novel has no real pages).
 *  • "event"  — a PDF scrolls inside its own container and reports REAL page
 *    numbers, and an HTML preview reports screenfuls from inside its iframe.
 *    Both arrive as {page, total}; this component just displays them.
 *
 * Cross-origin `link` previews can't be measured at all, so the caller doesn't
 * mount this for them.
 */

/** Hide near the very end so the readout never sits over the end-panel CTA. */
const HIDE_AT = 0.995;

type Place = { page: number; total: number } | null;

export function ReaderPageIndicator({ mode }: { mode: "window" | "event" }) {
  const [place, setPlace] = useState<Place>(null);
  const [atEnd, setAtEnd] = useState(false);
  // Reading has begun. In "event" mode this is implicit — neither the guard nor
  // the PDF viewer reports anything until the visitor scrolls — but the window
  // reader knows its position from the first frame, and showing "1/50" there
  // would put a pill directly under ReaderScrollHint's chevron, which occupies
  // the same patch of screen until the first scroll.
  const scrolled = useSyncExternalStore(subscribeFirstScroll, getScrolled, getScrolledServer);
  // Same signal as the back arrow and the actions menu (see product-actions).
  const chromeHidden = useChromeHidden();

  // EPUB: measure the book itself, not the document. The end panel lives in the
  // same scroll flow, and counting it would inflate every book by a page or two.
  useEffect(() => {
    if (mode !== "window") return;
    let tick = false;
    const measure = () => {
      const content = document.querySelector<HTMLElement>(".epub-inline");
      const vh = window.innerHeight;
      if (!content || vh === 0) return;
      const height = content.offsetHeight;
      if (height <= 0) return;
      const total = Math.max(1, Math.ceil(height / vh));
      // Distance read is measured from the top of the text, so a page of chrome
      // above it doesn't count as page one.
      const read = window.scrollY + vh - content.offsetTop;
      const page = Math.min(total, Math.max(1, Math.ceil(read / vh)));
      setPlace({ page, total });
      const max = document.documentElement.scrollHeight - vh;
      setAtEnd(max > 0 ? window.scrollY / max >= HIDE_AT : true);
    };
    const onScroll = () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        tick = false;
        measure();
      });
    };
    // A frame's grace so the chapter HTML has been injected and laid out.
    const raf = requestAnimationFrame(measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [mode]);

  // PDF (custom event) and HTML previews (postMessage from the guard).
  useEffect(() => {
    if (mode !== "event") return;
    const apply = (d: { page?: unknown; total?: unknown; prog?: unknown } | null) => {
      if (!d) return;
      const { page, total, prog } = d;
      if (typeof page !== "number" || typeof total !== "number" || total <= 0) return;
      setPlace({ page: Math.min(Math.max(1, page), total), total });
      if (typeof prog === "number") setAtEnd(prog >= HIDE_AT);
    };
    const onEvent = (e: Event) =>
      apply((e as CustomEvent<{ page?: number; total?: number; prog?: number }>).detail ?? null);
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { __lpPreview?: unknown } | null;
      if (d && typeof d === "object" && d.__lpPreview) apply(d as Record<string, unknown>);
    };
    window.addEventListener("lp-preview-scroll", onEvent as EventListener);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("lp-preview-scroll", onEvent as EventListener);
      window.removeEventListener("message", onMessage);
    };
  }, [mode]);

  // Nothing to say until something has been measured, and a one-page preview has
  // no position worth reporting.
  if (!place || place.total < 2) return null;
  if (mode === "window" && !scrolled) return null;

  return (
    <div
      className={`reader-place${atEnd || chromeHidden ? " is-hidden" : ""}`}
      role="status"
      aria-live="off"
      aria-label={`Halaman ${place.page} dari ${place.total}`}
    >
      {place.page}/{place.total}
    </div>
  );
}
