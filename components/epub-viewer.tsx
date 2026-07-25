"use client";

import { useEffect, useRef, useState } from "react";
import ePub, { type Rendition } from "epubjs";
import { useTheme } from "@/lib/use-theme";
import {
  EPUB_FONT_EVENT,
  EPUB_MARGIN_EVENT,
  clampEpubFont,
  clampEpubMargin,
  readEpubFont,
  readEpubMargin,
} from "@/lib/epub-font";
import { hideChrome, showChrome } from "@/lib/immersive";

// Zero gutter — the text column runs edge to edge (no padding/margin between the
// reader and the EPUB content). Injected after the book's own CSS so it wins by
// cascade order.
// Horizontal inset is set live via the margin override; keep the base gutter at 0.
const BODY_GUTTER = {
  margin: "0",
  "padding-top": "0.25rem",
  "padding-bottom": "0.25rem",
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

/**
 * Apply the horizontal margin symmetrically. box-sizing:border-box + width:100%
 * make padding shrink the text column on BOTH sides (instead of only shifting it
 * right, which overflows). Negative px uses negative body margin to bleed past
 * the edges. Overrides re-apply to each section via epub.js's content hook.
 */
function applyEpubMargin(rendition: Rendition, px: number): void {
  const pad = `${Math.max(0, px)}px`;
  const neg = `${Math.min(0, px)}px`;
  const t = rendition.themes;
  t.override("box-sizing", "border-box", true);
  t.override("width", "100%", true);
  t.override("max-width", "100%", true);
  t.override("padding-left", pad, true);
  t.override("padding-right", pad, true);
  t.override("margin-left", neg, true);
  t.override("margin-right", neg, true);
}

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
  const marginRef = useRef<number>(readEpubMargin());
  const { dark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ssr:false (see epub-reader), so reading localStorage in the initializer is
  // safe — this component only ever renders on the client. The font-size UI
  // lives in the actions menu; it broadcasts changes via EPUB_FONT_EVENT.
  const [fontPct, setFontPct] = useState<number>(readEpubFont);
  const [marginPx, setMarginPx] = useState<number>(readEpubMargin);

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

    // Force archive mode: a private-deliverable signed URL ends in "…epub?token=…",
    // so epub.js's extension sniffing would otherwise treat it as an unzipped
    // directory and fail to load.
    const book = ePub(url, { openAs: "epub" });
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
    // Re-apply the margin to every section as it renders (continuous scroll
    // streams new sections in), so the setting affects the whole book.
    rendition.on("rendered", () => applyEpubMargin(rendition, marginRef.current));

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

    // When only the first (short) section is loaded, the scroller doesn't
    // overflow yet — so scrollBy can't move and epub.js never loads the next
    // section (it only fills on scroll). Break that deadlock: if a wheel can't
    // move the scroller in its direction, advance/retreat a section instead.
    // Throttled so one gesture doesn't skip several sections.
    let paging = false;
    const advance = (dir: 1 | -1) => {
      if (paging) return;
      paging = true;
      Promise.resolve(dir > 0 ? rendition.next() : rendition.prev()).finally(() => {
        setTimeout(() => {
          paging = false;
        }, 250);
      });
    };

    const handleWheel = (e: WheelEvent) => {
      hideChrome(); // scrolling hides the reader chrome (focus mode)
      const el = scrollerEl();
      const before = el.scrollTop;
      el.scrollBy?.({ top: e.deltaY, left: e.deltaX });
      // Scroller couldn't move (not scrollable, or already at the edge) → load
      // the neighbouring section so scrolling can continue.
      if (Math.abs(el.scrollTop - before) < 1 && Math.abs(e.deltaY) > 0) {
        advance(e.deltaY > 0 ? 1 : -1);
      }
    };

    // Manual double-tap detector: two taps within 350ms show the chrome.
    // `dblclick` is unreliable on touch devices, so we track taps ourselves.
    let lastTapAt = 0;
    const onTap = () => {
      const t = Date.now();
      if (t - lastTapAt < 350) {
        lastTapAt = 0;
        showChrome();
      } else {
        lastTapAt = t;
      }
    };

    // Inside each section's iframe (the text column): forward wheel for scroll,
    // touchmove to hide, and a double-tap (click x2) to show the chrome.
    rendition.hooks.content.register((contents: { document?: Document }) => {
      const d = contents?.document;
      if (!d) return;
      d.addEventListener("wheel", handleWheel, { passive: true });
      d.addEventListener("touchmove", hideChrome, { passive: true });
      d.addEventListener("click", onTap);
    });
    // …and over the surrounding letterbox margins (host's parent), so scrolling
    // works anywhere in the reader, not just on the narrowed column.
    const outer = host.parentElement;
    outer?.addEventListener("wheel", handleWheel, { passive: true });

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
      outer?.removeEventListener("wheel", handleWheel);
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
    renditionRef.current?.themes.fontSize(`${fontPct}%`);
  }, [fontPct]);

  // Apply the horizontal display margin live to every section. Positive px =
  // symmetric padding (border-box so the right side shrinks too, not just a
  // left shift); negative px = negative body margin so text bleeds past edges.
  useEffect(() => {
    marginRef.current = marginPx;
    if (renditionRef.current) applyEpubMargin(renditionRef.current, marginPx);
  }, [marginPx]);

  // Follow font-size / margin changes broadcast from the actions menu.
  useEffect(() => {
    const onFont = (e: Event) => {
      const pct = (e as CustomEvent).detail as number;
      if (typeof pct === "number") setFontPct(clampEpubFont(pct));
    };
    const onMargin = (e: Event) => {
      const px = (e as CustomEvent).detail as number;
      if (typeof px === "number") setMarginPx(clampEpubMargin(px));
    };
    window.addEventListener(EPUB_FONT_EVENT, onFont);
    window.addEventListener(EPUB_MARGIN_EVENT, onMargin);
    return () => {
      window.removeEventListener(EPUB_FONT_EVENT, onFont);
      window.removeEventListener(EPUB_MARGIN_EVENT, onMargin);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fdfcfb] dark:bg-[#141414]">
      {/* Full-width host — the horizontal inset is controlled by the margin
          setting (px, can be negative), applied on the content body. */}
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
