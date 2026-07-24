"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/use-theme";

type PreviewMode = "html" | "pdf" | "link" | "epub";

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
  const { dark } = useTheme();

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
    // The dark toggle now lives in the grouped ProductActionsMenu (rendered by
    // the page). This surface just wraps the preview and keeps the iframe's dark
    // mode in sync with the app theme.
    <div ref={wrapperRef} className={`h-full w-full ${wrapperDark ? "preview-dark" : ""}`}>
      {children}
    </div>
  );
}
