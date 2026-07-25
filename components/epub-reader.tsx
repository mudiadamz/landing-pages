"use client";

import dynamic from "next/dynamic";

// Inline EPUB renderer (no iframe): unzips + injects the book into the page DOM
// so scroll, taps and styling are all native. Client-only (fflate + DOMParser).
const EpubViewer = dynamic(() => import("./epub-inline-viewer"), {
  ssr: false,
  // No fallback UI: EpubSplash covers the whole load, so anything here would
  // just flash behind it.
  loading: () => null,
});

export function EpubReader({
  url,
  slug,
  title,
  thumbnailUrl,
  storageKey,
}: {
  url: string;
  /** Product slug — enables the fast server-unzipped chapter fetch. */
  slug?: string;
  title?: string;
  /** Cover art for the loading splash. */
  thumbnailUrl?: string | null;
  storageKey?: string;
}) {
  // Re-key on the source so switching files cleanly reloads the reader.
  return (
    <EpubViewer
      key={url}
      url={url}
      slug={slug}
      title={title}
      thumbnailUrl={thumbnailUrl}
      storageKey={storageKey}
    />
  );
}
