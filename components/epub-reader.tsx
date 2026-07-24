"use client";

import dynamic from "next/dynamic";

// epub.js touches browser-only APIs (iframes, workers, XHR), so load the viewer
// client-side only — mirrors how the PDF viewer is wired.
const EpubViewer = dynamic(() => import("./epub-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-[var(--muted)]">
      Memuat EPUB…
    </div>
  ),
});

export function EpubReader({
  url,
  title,
  storageKey,
}: {
  url: string;
  title?: string;
  storageKey?: string;
}) {
  // Re-key on the source so switching files cleanly reloads the reader.
  return <EpubViewer key={url} url={url} title={title} storageKey={storageKey} />;
}
