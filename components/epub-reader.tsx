"use client";

import dynamic from "next/dynamic";

// Inline EPUB renderer (no iframe): unzips + injects the book into the page DOM
// so scroll, taps and styling are all native. Client-only (fflate + DOMParser).
const EpubViewer = dynamic(() => import("./epub-inline-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 w-full items-center justify-center text-sm text-[var(--muted)]">
      Memuat EPUB…
    </div>
  ),
});

export function EpubReader({
  url,
  slug,
  title,
  storageKey,
}: {
  url: string;
  /** Product slug — enables the fast server-unzipped chapter fetch. */
  slug?: string;
  title?: string;
  storageKey?: string;
}) {
  // Re-key on the source so switching files cleanly reloads the reader.
  return <EpubViewer key={url} url={url} slug={slug} title={title} storageKey={storageKey} />;
}
