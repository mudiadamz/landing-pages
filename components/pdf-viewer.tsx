"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Use the worker that ships with the installed pdfjs-dist (kept in version sync).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

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
 * Renders a single page only once it scrolls near the viewport, so a long PDF
 * loads page-by-page instead of rasterizing every page up front.
 */
function LazyPage({
  pageNumber,
  width,
  eager,
}: {
  pageNumber: number;
  width: number;
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!!eager);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className="flex justify-center" style={{ minWidth: width }}>
      {visible ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={<Placeholder />}
          className="shadow-sm"
        />
      ) : (
        <div style={{ width }}>
          <Placeholder />
        </div>
      )}
    </div>
  );
}

export default function PdfViewer({ url }: { url: string; title?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTick = useRef(false);
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(720);

  // Report scroll depth so the sticky "Beli sekarang" CTA can reveal itself
  // once the visitor has scrolled a few screens into the document.
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (scrollTick.current) return;
    scrollTick.current = true;
    const el = e.currentTarget;
    requestAnimationFrame(() => {
      scrollTick.current = false;
      const past = el.scrollTop > el.clientHeight * 1.5;
      window.dispatchEvent(new CustomEvent("lp-preview-scroll", { detail: { past } }));
    });
  }

  // Fit page width to the container (capped for readability on wide screens).
  useEffect(() => {
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

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      // `pdf-auto-dark` makes the preview follow the device's dark mode
      // automatically (see globals.css) even though the app forces a light
      // color-scheme on :root.
      className="pdf-auto-dark w-full h-full overflow-y-auto overflow-x-hidden bg-[var(--background)] py-4"
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
          <LazyPage key={i + 1} pageNumber={i + 1} width={width} eager={i === 0} />
        ))}
      </Document>
    </div>
  );
}
