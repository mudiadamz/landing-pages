"use client";

import dynamic from "next/dynamic";

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

export function PdfPreview({ url, title }: { url: string; title?: string }) {
  return (
    <div className="w-full h-full">
      <PdfViewer url={url} title={title} />
    </div>
  );
}
