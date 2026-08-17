"use client";

import dynamic from "next/dynamic";
import { useT } from "@/lib/i18n/client";
import { useTheme } from "@/lib/use-theme";

// pdf.js touches browser-only APIs (canvas, workers), so load the viewer
// client-side only.
// A component, so the placeholder can use the hook.
function PdfLoading() {
  const t = useT();
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-[var(--muted)]">
      {t("product.loadingPdf")}
    </div>
  );
}

const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => <PdfLoading />,
});

export function PdfPreview({
  url,
  urlDark,
  title,
  storageKey,
  endPanel,
}: {
  /** Light / default PDF. Always set (the caller falls back to the dark one). */
  url: string;
  /** Optional dark-theme PDF; shown only when the reader is in dark mode. */
  urlDark?: string | null;
  title?: string;
  /** Stable key to remember scroll position across reloads (see PdfViewer). */
  storageKey?: string;
  /** End-of-read panel rendered after the last page (see PdfViewer). */
  endPanel?: React.ReactNode;
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
        endPanel={endPanel}
      />
    </div>
  );
}
