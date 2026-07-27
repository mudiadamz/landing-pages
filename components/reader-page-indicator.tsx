"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getScrolled, getScrolledServer, subscribeFirstScroll } from "@/lib/first-scroll";
import { showChrome, useChromeHidden } from "@/lib/immersive";
import { trackCta } from "@/lib/track";
import { ReaderChapterSheet, type ChapterItem } from "./reader-chapter-sheet";

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
 * In the inline reader it's also the way into the book: tapping it opens the
 * chapter list (ReaderChapterSheet) and picking a chapter scrolls there. That
 * makes one small target serve both questions a reader has about position — where
 * am I, and how do I get somewhere else — instead of spending a second ornament
 * on a table of contents.
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

/** Where in the viewport a chapter must start to count as "the one being read". */
const CURRENT_AT = 0.3;

/** Breathing room above a chapter heading after jumping to it. */
const CHAPTER_OFFSET = 12;

/** Length of the one-off "this is a button" pulse; matches the CSS animation. */
const PING_MS = 900;

/**
 * The book's own table of contents, read back out of the rendered chapters.
 *
 * There's no TOC in the data: chapters arrive as raw spine markup (see
 * lib/epub-server), so the heading each exporter chose is the only title that
 * exists. Hence the ladder of fallbacks — `.chapter-title` and `.chapter-num` are
 * the conventional class names, a plain heading is the common case, and front
 * matter often has neither.
 */
function readChapters(): ChapterItem[] {
  const content = document.querySelector<HTMLElement>(".epub-inline");
  const vh = window.innerHeight;
  if (!content || vh === 0) return [];
  const contentTop = content.getBoundingClientRect().top + window.scrollY;

  const text = (el: Element | null) => el?.textContent?.trim().replace(/\s+/g, " ") || "";
  const out: ChapterItem[] = [];

  content.querySelectorAll<HTMLElement>(".epub-chapter").forEach((el, i) => {
    const num = text(el.querySelector(".chapter-num"));
    const label =
      text(el.querySelector(".chapter-title")) ||
      text(el.querySelector("h1, h2, h3, h4")) ||
      num ||
      `Bagian ${i + 1}`;
    const top = el.getBoundingClientRect().top + window.scrollY;
    // Same screenful arithmetic as the readout, so the number in the list is the
    // number the reader will see once they land there.
    const page = Math.max(1, Math.ceil((top + vh - contentTop) / vh));
    out.push({ el, num: num && num !== label ? num : undefined, label, page });
  });

  return out;
}

export function ReaderPageIndicator({
  mode,
  slug,
}: {
  mode: "window" | "event";
  /** For the `toc` CTA event — whether readers actually use the chapter list. */
  slug?: string;
}) {
  const [place, setPlace] = useState<Place>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [chapterCount, setChapterCount] = useState(0);
  const [pinged, setPinged] = useState(false);
  const pingStartedRef = useRef(false);
  // Open sheet: the chapters as measured at open time, plus which one was being
  // read. Null when closed.
  const [toc, setToc] = useState<{ items: ChapterItem[]; current: number } | null>(null);
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
      // Only a multi-chapter book has a list worth opening.
      setChapterCount(content.querySelectorAll(".epub-chapter").length);
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

  // Only the inline reader has chapters to list; a PDF or HTML demo reports
  // position but has no structure behind it, so its readout stays a readout.
  const hasChapters = mode === "window" && chapterCount > 1;

  const shown = !!place && place.total >= 2 && (mode !== "window" || scrolled);
  const hidden = (atEnd || chromeHidden) && !toc;

  // A single pulse the first time the readout is on screen, to say that this one
  // is a button. Fires exactly once per mount: `startedRef` means a chrome fade
  // mid-animation can't restart it, and the CSS animation runs one iteration, so
  // a small target that would otherwise look like a label announces itself and
  // then stops asking for attention.
  useEffect(() => {
    if (!hasChapters || !shown || hidden || pingStartedRef.current) return;
    pingStartedRef.current = true;
    const done = window.setTimeout(() => setPinged(true), PING_MS);
    return () => window.clearTimeout(done);
  }, [hasChapters, shown, hidden]);

  const open = () => {
    const items = readChapters();
    if (items.length < 2) return;
    // Which chapter is being read, measured once here rather than on every render
    // — the readout keeps updating behind the sheet, and re-deriving this from the
    // DOM each time would mean a rect read per chapter per scroll frame.
    const mark = window.scrollY + window.innerHeight * CURRENT_AT;
    let current = 0;
    items.forEach((item, i) => {
      if (item.el.getBoundingClientRect().top + window.scrollY <= mark) current = i;
    });
    setToc({ items, current });
    if (slug) trackCta(slug, "preview", "toc");
  };

  const go = (item: ChapterItem) => {
    setToc(null);
    const top = item.el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: Math.max(0, top - CHAPTER_OFFSET),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    // The chrome faded when they scrolled to get here; the reader has just made a
    // deliberate move, so give the controls back rather than leaving a bare page.
    showChrome();
  };

  // Nothing to say until something has been measured, and a one-page preview has
  // no position worth reporting.
  if (!shown || !place) return null;

  // `hidden` keeps the trigger in place while the sheet is open, even if focus
  // mode would have taken it (mirrors `chromeHidden && !open` in product-actions).
  const hide = hidden;
  const readout = `${place.page}/${place.total}`;

  return (
    <>
      {hasChapters ? (
        <button
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          aria-expanded={!!toc}
          aria-label={`Halaman ${place.page} dari ${place.total} — buka daftar bab`}
          className={`reader-place is-button${hide ? " is-hidden" : ""}${
            pinged ? "" : " is-new"
          }`}
        >
          {readout}
        </button>
      ) : (
        <div
          className={`reader-place${hide ? " is-hidden" : ""}`}
          role="status"
          aria-live="off"
          aria-label={`Halaman ${place.page} dari ${place.total}`}
        >
          {readout}
        </div>
      )}

      {toc && (
        <ReaderChapterSheet
          items={toc.items}
          currentIndex={toc.current}
          onSelect={go}
          onClose={() => setToc(null)}
        />
      )}
    </>
  );
}
