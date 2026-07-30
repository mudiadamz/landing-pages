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
  textEndpoint,
  version,
  storageKey,
}: {
  url: string;
  /** Product slug — enables the fast server-unzipped chapter fetch. */
  slug?: string;
  title?: string;
  /** Override the chapter source (owner's reader uses a gated endpoint). */
  textEndpoint?: string;
  /** Content version — busts the edge cache when the book is edited. */
  version?: string;
  storageKey?: string;
}) {
  // Re-key on the source so switching files cleanly reloads the reader. Falls
  // back to the slug because an excerpt has no archive URL at all, and `key=""`
  // is not a usable identity.
  return (
    <EpubViewer
      key={url || slug || "epub"}
      url={url}
      slug={slug}
      title={title}
      textEndpoint={textEndpoint}
      version={version}
      storageKey={storageKey}
    />
  );
}
