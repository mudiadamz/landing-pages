"use client";

import { useState } from "react";
import { PdfPreview } from "./pdf-preview";

// Lets a buyer read a product's story PDF in the same viewer used on the
// product preview. Fetches a gated signed URL on demand (see /api/story/[slug]).
export function StoryPdfButton({
  slug,
  title,
  className,
}: {
  slug: string;
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openReader() {
    setOpen(true);
    if (url) return; // already loaded once this session
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/story/${slug}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memuat PDF");
        return;
      }
      setUrl(data.url as string);
    } catch {
      setError("Gagal memuat PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openReader}
        className={className ?? "text-sm font-medium text-[var(--primary)] hover:underline"}
      >
        Baca cerita
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Cerita: ${title}`}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--card)] border-b border-[var(--border)]">
            <p className="font-medium text-foreground truncate">{title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 text-sm font-medium text-[var(--muted)] hover:text-foreground transition-colors"
            >
              ✕ Tutup
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-[var(--background)]">
            {loading && (
              <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                Memuat PDF…
              </div>
            )}
            {error && (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-500">
                {error}
              </div>
            )}
            {url && !loading && !error && <PdfPreview url={url} title={title} />}
          </div>
        </div>
      )}
    </>
  );
}
