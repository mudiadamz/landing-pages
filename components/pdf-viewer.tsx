"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Use the worker that ships with the installed pdfjs-dist (kept in version sync).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// A4 portrait height/width ratio — a sane default so unrendered pages still
// reserve a plausible height (keeps scroll length stable before/after render).
const DEFAULT_RATIO = 297 / 210;

// Cap canvas resolution: mobile Safari has a hard per-tab memory ceiling and a
// DPR-3 phone would otherwise rasterize every page at ~9x the pixels. 2 keeps
// it crisp while roughly halving per-page memory on retina screens.
const MAX_DPR = 2;

function Placeholder({ height = 460 }: { height?: number }) {
  return (
    <div
      className="w-full animate-pulse rounded bg-[var(--border)]/40"
      style={{ height }}
    />
  );
}

function OpenPdfLink({ url }: { url: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--primary)] underline"
      >
        Buka PDF
      </a>
    </div>
  );
}

/**
 * Renders a single page only while it's near the viewport and unmounts it (freeing
 * the canvas) once it scrolls far away. Without this, scrolling through a long PDF
 * accumulates every page's canvas in memory — on mobile Safari that trips the
 * per-tab memory limit and the browser kills + reloads the tab. The rendered
 * height is measured once and reserved even while unmounted, so releasing a page
 * never shifts the scroll position.
 */
function LazyPage({
  pageNumber,
  width,
  dpr,
  eager,
}: {
  pageNumber: number;
  width: number;
  dpr: number;
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!!eager);
  // Persists across visible toggles (this wrapper never unmounts), so a page
  // that has rendered once keeps reserving its real height when released.
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const reserved = height ?? Math.round(width * DEFAULT_RATIO);

  return (
    <div
      ref={ref}
      className="flex justify-center"
      style={{ minWidth: width, minHeight: reserved }}
    >
      {visible ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          devicePixelRatio={dpr}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onRenderSuccess={() => {
            const h = ref.current?.clientHeight;
            if (h && h > 0) setHeight(h);
          }}
          loading={<Placeholder height={reserved} />}
          className="shadow-sm"
        />
      ) : (
        <Placeholder height={reserved} />
      )}
    </div>
  );
}

export default function PdfViewer({
  url,
  storageKey,
}: {
  url: string;
  title?: string;
  /** When set, scroll position is saved/restored under this key (survives the
   *  mobile-Safari crash-reload). Should be stable across reloads for one PDF. */
  storageKey?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTick = useRef(false);
  const restored = useRef(false);
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(720);
  const [dpr, setDpr] = useState(1);

  // Report scroll depth so the sticky "Beli sekarang" CTA can reveal itself
  // once the visitor has scrolled a few screens into the document, and remember
  // the position so a crash-reload lands back where they were.
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (scrollTick.current) return;
      scrollTick.current = true;
      const el = e.currentTarget;
      requestAnimationFrame(() => {
        scrollTick.current = false;
        const past = el.scrollTop > el.clientHeight * 1.5;
        window.dispatchEvent(new CustomEvent("lp-preview-scroll", { detail: { past } }));
        if (storageKey) {
          try {
            sessionStorage.setItem(storageKey, String(Math.round(el.scrollTop)));
          } catch {
            /* storage unavailable (private mode) — position memory is best-effort */
          }
        }
      });
    },
    [storageKey],
  );

  // Fit page width to the container (capped for readability on wide screens) and
  // clamp the canvas resolution.
  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.min(el.clientWidth - 24, 900);
      if (w > 0) setWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Restore the saved scroll position once the document's page count is known:
  // every page reserves an estimated height up front, so total scroll length is
  // stable enough to seek to the saved offset before pages lazily render in.
  useEffect(() => {
    if (!storageKey || !numPages || restored.current) return;
    const el = containerRef.current;
    if (!el) return;
    restored.current = true;
    let saved = 0;
    try {
      saved = Number(sessionStorage.getItem(storageKey)) || 0;
    } catch {
      /* ignore */
    }
    if (saved > 0) {
      requestAnimationFrame(() => {
        el.scrollTop = saved;
      });
    }
  }, [numPages, storageKey]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      // Theme-aware surround: PDFs are no longer colour-inverted, so the padding
      // around/between pages follows the app theme — a light frame in light mode,
      // a dark frame in dark mode (which suits a seller's dark-version PDF).
      className="w-full h-full overflow-y-auto overflow-x-hidden bg-[#fdfcfb] dark:bg-[#141414] py-4"
    >
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={
          <div className="px-3">
            <Placeholder />
          </div>
        }
        error={<OpenPdfLink url={url} />}
        noData={<OpenPdfLink url={url} />}
        className="flex flex-col items-center gap-4"
      >
        {Array.from({ length: numPages }, (_, i) => (
          <LazyPage key={i + 1} pageNumber={i + 1} width={width} dpr={dpr} eager={i === 0} />
        ))}
      </Document>
    </div>
  );
}
