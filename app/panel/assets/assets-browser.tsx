"use client";

import { useCallback, useMemo, useState } from "react";
import { uploadLibraryAsset, listLibraryAssets } from "@/lib/actions/assets";
import { useT } from "@/lib/i18n/client";

type Asset = { name: string; url: string };

const PAGE_SIZE = 24;

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url);
}

export function AssetsBrowser({ initialAssets }: { initialAssets: Asset[] }) {
  const t = useT();
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setAssets(await listLibraryAssets());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => a.name.toLowerCase().includes(q));
  }, [assets, query]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await uploadLibraryAsset(formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        await refresh();
        setPage(1);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied((c) => (c === url ? null : c)), 1500);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: upload + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="shrink-0">
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,video/ogg"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
          <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {uploading ? t("panel.uploading") : t("assets.upload")}
          </span>
        </label>

        <div className="relative w-full sm:max-w-xs">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--muted)]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t("panel.searchFiles")}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 p-10 text-center text-sm text-[var(--muted)]">
          {query.trim() ? t("assets.noMatch", { query: query.trim() }) : t("assets.none")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {slice.map((a) => (
              <div
                key={a.url}
                className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm"
              >
                <div className="flex aspect-square items-center justify-center bg-[var(--background)]">
                  {isImage(a.url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-xs font-medium text-[var(--muted)]">video</span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate font-mono text-xs text-foreground" title={a.name}>
                    {a.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyUrl(a.url)}
                    className="mt-1 text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    {copied === a.url ? "Tersalin!" : t("assets.copyUrl")}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-[var(--muted)]">
              {t("assets.showingRange", {
                from: start + 1,
                to: start + slice.length,
                total,
              })}
            </p>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
                  disabled={currentPage <= 1}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-[var(--background)] disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <span className="text-sm text-[var(--muted)]">
                  {currentPage} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((n) => Math.min(pageCount, n + 1))}
                  disabled={currentPage >= pageCount}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-[var(--background)] disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
