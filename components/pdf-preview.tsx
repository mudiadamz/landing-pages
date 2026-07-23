"use client";

import dynamic from "next/dynamic";
import { useTheme } from "@/lib/use-theme";

// pdf.js touches browser-only APIs (canvas, workers), so load the viewer
// client-side only.
const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-[var(--muted)]">
      Memuat PDF…
    </div>
  ),
});

export function PdfPreview({
  url,
  urlDark,
  title,
  storageKey,
  revealAt,
}: {
  /** Light / default PDF. Always set (the caller falls back to the dark one). */
  url: string;
  /** Optional dark-theme PDF; shown only when the reader is in dark mode. */
  urlDark?: string | null;
  title?: string;
  /** Stable key to remember scroll position across reloads (see PdfViewer). */
  storageKey?: string;
  /** Scroll-progress fraction (0..1) at which the buy CTA reveals. */
  revealAt?: number;
}) {
  const { dark } = useTheme();
  // Follow the theme only when a dark variant exists; otherwise the single
  // uploaded file is shown regardless of theme.
  const effectiveUrl = dark && urlDark ? urlDark : url;

  return (
    <div className="w-full h-full">
      {/* Re-key on the source so switching theme cleanly reloads the viewer. */}
      <PdfViewer
        key={effectiveUrl}
        url={effectiveUrl}
        title={title}
        storageKey={storageKey}
        revealAt={revealAt}
      />
    </div>
  );
}
