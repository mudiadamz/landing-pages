"use client";

import { useCallback, useState } from "react";
import { EpubReader } from "./epub-reader";
import { useTheme } from "@/lib/use-theme";
import {
  readEpubFont,
  setEpubFont,
  readEpubMargin,
  setEpubMargin,
  clampEpubMargin,
  EPUB_MARGIN_STEP,
  EPUB_MARGIN_MIN,
  EPUB_MARGIN_MAX,
  type EpubFontLevel,
} from "@/lib/epub-font";

const FONT_LEVELS: { level: EpubFontLevel; label: string; cls: string }[] = [
  { level: "small", label: "Kecil", cls: "text-[11px]" },
  { level: "medium", label: "Sedang", cls: "text-sm" },
  { level: "large", label: "Besar", cls: "text-lg" },
];

// Lets a buyer read a product's EPUB deliverable in the same reader used on the
// product preview. Fetches a gated signed URL on demand (see /api/story-epub).
export function EpubStoryButton({
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
  const { dark, toggle: toggleDark } = useTheme();
  const [fontLevel, setFontLevel] = useState<EpubFontLevel>(readEpubFont);
  const onFont = useCallback((level: EpubFontLevel) => {
    setFontLevel(level);
    setEpubFont(level);
  }, []);
  const [marginPx, setMarginPx] = useState<number>(readEpubMargin);
  const onMargin = useCallback((px: number) => {
    const v = clampEpubMargin(px);
    setMarginPx(v);
    setEpubMargin(v);
  }, []);

  async function openReader() {
    setOpen(true);
    if (url) return; // already loaded once this session
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/story-epub/${slug}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memuat EPUB");
        return;
      }
      setUrl(data.url as string);
    } catch {
      setError("Gagal memuat EPUB");
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
        Baca EPUB
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`EPUB: ${title}`}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--card)] border-b border-[var(--border)]">
            <p className="font-medium text-foreground truncate">{title}</p>
            <div className="flex shrink-0 items-center gap-1">
              <div className="mr-1 flex items-center gap-0.5 rounded-lg border border-[var(--border)] p-0.5">
                {FONT_LEVELS.map((f) => {
                  const active = f.level === fontLevel;
                  return (
                    <button
                      key={f.level}
                      type="button"
                      aria-pressed={active}
                      title={`Font ${f.label}`}
                      aria-label={`Ukuran font ${f.label}`}
                      onClick={() => onFont(f.level)}
                      className={`flex h-6 w-6 items-center justify-center rounded-md font-semibold leading-none transition-colors ${f.cls} ${
                        active
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-foreground"
                      }`}
                    >
                      A
                    </button>
                  );
                })}
              </div>
              <div className="mr-1 flex items-center gap-0.5 rounded-lg border border-[var(--border)] p-0.5">
                <button
                  type="button"
                  onClick={() => onMargin(marginPx - EPUB_MARGIN_STEP)}
                  disabled={marginPx <= EPUB_MARGIN_MIN}
                  aria-label="Kurangi margin"
                  title="Kurangi margin"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-base font-semibold leading-none text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground disabled:opacity-40"
                >
                  −
                </button>
                <span
                  className="w-10 text-center text-[11px] font-medium tabular-nums text-foreground"
                  title="Margin (px)"
                >
                  {marginPx}px
                </span>
                <button
                  type="button"
                  onClick={() => onMargin(marginPx + EPUB_MARGIN_STEP)}
                  disabled={marginPx >= EPUB_MARGIN_MAX}
                  aria-label="Tambah margin"
                  title="Tambah margin"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-base font-semibold leading-none text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground disabled:opacity-40"
                >
                  +
                </button>
              </div>
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
          <div className="flex-1 min-h-0">
            {loading && (
              <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                Memuat EPUB…
              </div>
            )}
            {error && (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-500">
                {error}
              </div>
            )}
            {url && !loading && !error && (
              <EpubReader url={url} title={title} storageKey={`story-epub:${slug}`} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
