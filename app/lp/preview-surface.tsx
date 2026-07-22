"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/use-theme";

type PreviewMode = "html" | "pdf" | "link";

/**
 * Wraps the preview content and provides the dark-mode toggle. Dark state is the
 * app-wide theme (see lib/use-theme) — toggling here also flips the front/panel
 * theme, and vice-versa. Default is light (the site's default theme).
 *
 * The dark effect never touches the toolbar, buy CTA, or host page. For HTML
 * previews it's injected INSIDE the iframe (see preview-guard) so images can be
 * re-inverted and keep their real colours. PDF previews are NOT colour-inverted
 * — instead the viewer swaps to the seller's dark-version PDF when one exists
 * (see PdfPreview). Only cross-origin `link` previews still fall back to a plain
 * CSS invert filter on the wrapper.
 */
export function PreviewSurface({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: PreviewMode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { dark, toggle } = useTheme();

  // HTML previews: tell the iframe to (un)apply its own image-preserving dark
  // mode. Re-send on load in case the toggle changed before the frame loaded.
  useEffect(() => {
    if (mode !== "html") return;
    const iframe = wrapperRef.current?.querySelector("iframe");
    if (!iframe) return;
    const send = () => iframe.contentWindow?.postMessage({ __lpSetDark: dark }, "*");
    send();
    iframe.addEventListener("load", send);
    return () => iframe.removeEventListener("load", send);
  }, [dark, mode]);

  // Only external links still get the crude CSS invert (cross-origin, can't
  // inject or swap the source). PDFs switch to a dark-version file instead.
  const wrapperDark = dark && mode === "link";

  return (
    <>
      <div ref={wrapperRef} className={`h-full w-full ${wrapperDark ? "preview-dark" : ""}`}>
        {children}
      </div>

      <div className="fixed top-4 right-4 z-50 pointer-events-none">
        <div className="pointer-events-auto flex items-center p-1.5 rounded-xl bg-[var(--card)]/90 backdrop-blur border border-[var(--border)] shadow-lg">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={dark}
            aria-label={dark ? "Mode terang" : "Mode gelap"}
            title={dark ? "Mode terang" : "Mode gelap"}
            className="p-1.5 rounded-lg text-foreground hover:bg-[var(--background)] active:scale-95 transition-all duration-150"
          >
            {dark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
