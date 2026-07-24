"use client";

import { useEffect, useRef, useState } from "react";
import ePub, { type Rendition } from "epubjs";
import { useTheme } from "@/lib/use-theme";
import {
  EPUB_FONT_EVENT,
  EPUB_FONT_SIZES,
  readEpubFont,
  type EpubFontLevel,
} from "@/lib/epub-font";

// Zero gutter — the text column runs edge to edge (no padding/margin between the
// reader and the EPUB content). Injected after the book's own CSS so it wins by
// cascade order.
const BODY_GUTTER = {
  margin: "0",
  padding: "0",
} as const;

const THEMES = {
  light: {
    body: { background: "#fdfcfb", color: "#1a1a1a", ...BODY_GUTTER },
    a: { color: "#2563eb" },
  },
  dark: {
    body: { background: "#141414", color: "#d4d4d4", ...BODY_GUTTER },
    a: { color: "#8ab4f8" },
  },
} as const;

export default function EpubViewer({
  url,
  storageKey,
}: {
  url: string;
  title?: string;
  /** Stable key to remember the reading position (CFI) across reloads. */
  storageKey?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const { dark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ssr:false (see epub-reader), so reading localStorage in the initializer is
  // safe — this component only ever renders on the client. The font-size UI
  // lives in the actions menu; it broadcasts changes via EPUB_FONT_EVENT.
  const [fontLevel, setFontLevel] = useState<EpubFontLevel>(readEpubFont);

  // Build the book + rendition once per source. Theme + font are applied by the
  // separate effects below (so changing them doesn't reload the book).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let destroyed = false;

    let saved: string | null = null;
    try {
      saved = storageKey ? sessionStorage.getItem(storageKey) : null;
    } catch {
      /* storage unavailable (private mode) — position memory is best-effort */
    }

    const book = ePub(url);
    const rendition = book.renderTo(host, {
      width: "100%",
      height: "100%",
      // Continuous vertical scroll through the whole book (sections stream in as
      // the reader scrolls) instead of paginated left/right flipping.
      flow: "scrolled",
      manager: "continuous",
      // Sandbox the seller-supplied EPUB — never run scripts it ships with.
      allowScriptedContent: false,
    });
    renditionRef.current = rendition;
    rendition.themes.register("light", THEMES.light);
    rendition.themes.register("dark", THEMES.dark);

    // Continuous scroll fix (Mac Chrome trackpad, and mouse wheels generally):
    // each section renders inside an iframe that swallows wheel/two-finger
    // events, so they never reach epub.js's scroll container and the page won't
    // move. Forward wheel deltas from every content document to that scroller.
    const isScrollable = (el: Element | null | undefined): el is Element =>
      !!el && el.scrollHeight > el.clientHeight + 1;
    const scrollerEl = (): (Element & { scrollBy?: (o: ScrollToOptions) => void }) => {
      const mgr = (rendition as unknown as { manager?: { container?: Element | null } }).manager;
      const inner = mgr?.container ?? null;
      // The real scroller is whichever of these actually overflows: epub.js's
      // overflow wrapper (parent of its container), the container, or the host.
      const candidates = [inner?.parentElement ?? null, inner, host.firstElementChild, host];
      return (candidates.find(isScrollable) ?? host) as Element & {
        scrollBy?: (o: ScrollToOptions) => void;
      };
    };
    rendition.hooks.content.register((contents: { document?: Document }) => {
      const doc = contents?.document;
      if (!doc) return;
      doc.addEventListener(
        "wheel",
        (e: WheelEvent) => {
          const el = scrollerEl();
          el?.scrollBy?.({ top: e.deltaY, left: e.deltaX });
        },
        { passive: true },
      );
    });

    rendition
      .display(saved || undefined)
      .then(() => {
        if (!destroyed) setLoading(false);
      })
      .catch(() => {
        if (!destroyed) {
          setError("Gagal memuat EPUB.");
          setLoading(false);
        }
      });

    rendition.on("relocated", (loc: { start?: { cfi?: string } }) => {
      try {
        if (storageKey && loc?.start?.cfi) sessionStorage.setItem(storageKey, loc.start.cfi);
      } catch {
        /* best-effort */
      }
    });

    return () => {
      destroyed = true;
      try {
        book.destroy();
      } catch {
        /* ignore teardown errors */
      }
      renditionRef.current = null;
    };
  }, [url, storageKey]);

  // Re-theme on toggle (also runs on mount to set the initial theme).
  useEffect(() => {
    renditionRef.current?.themes.select(dark ? "dark" : "light");
  }, [dark]);

  // Apply the font size (also runs on mount for the initial size).
  useEffect(() => {
    renditionRef.current?.themes.fontSize(EPUB_FONT_SIZES[fontLevel]);
  }, [fontLevel]);

  // Follow font-size changes broadcast from the actions menu.
  useEffect(() => {
    const onFont = (e: Event) => {
      const level = (e as CustomEvent).detail as EpubFontLevel;
      if (level === "small" || level === "medium" || level === "large") setFontLevel(level);
    };
    window.addEventListener(EPUB_FONT_EVENT, onFont);
    return () => window.removeEventListener(EPUB_FONT_EVENT, onFont);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fdfcfb] dark:bg-[#141414]">
      <div ref={hostRef} className="h-full w-full" />

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]">
          Memuat EPUB…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}
