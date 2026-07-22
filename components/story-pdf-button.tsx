"use client";

import { useState } from "react";
import { PdfPreview } from "./pdf-preview";
import { useTheme } from "@/lib/use-theme";

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
  const [urlDark, setUrlDark] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dark, toggle: toggleDark } = useTheme();

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
      setUrlDark((data.urlDark as string | null) ?? null);
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
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={toggleDark}
                aria-pressed={dark}
                aria-label={dark ? "Mode terang" : "Mode gelap"}
                title={dark ? "Mode terang" : "Mode gelap"}
                className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--background)] hover:text-foreground active:scale-95 transition-all"
              >
                {dark ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-[var(--muted)] hover:text-foreground transition-colors"
              >
                ✕ Tutup
              </button>
            </div>
          </div>
          {/* No colour inversion: dark mode swaps to the seller's dark-version
              PDF when one exists (see PdfPreview). Surround follows the theme. */}
          <div className="flex-1 min-h-0 bg-[#fdfcfb] dark:bg-[#141414]">
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
            {url && !loading && !error && (
              <PdfPreview url={url} urlDark={urlDark} title={title} storageKey={`story-pdf:${slug}`} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
