"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { uploadLibraryAsset, listLibraryAssets } from "@/lib/actions/assets";

type Asset = { name: string; url: string };

/**
 * Self-contained, page-agnostic asset library popup. Drop it anywhere and
 * control it with `open`/`onClose` — it renders into a portal on document.body,
 * so it is independent of any surrounding layout/stacking context.
 */
export function AssetLibraryModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const loadAssets = useCallback(async () => {
    setLoadingList(true);
    try {
      setAssets(await listLibraryAssets());
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Refresh the list whenever the popup opens.
  useEffect(() => {
    if (open) loadAssets();
  }, [open, loadAssets]);

  // Esc to close + lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

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
        await loadAssets();
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

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Assets"
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-foreground">Assets</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Upload images or videos. Copy the URL and paste into your HTML.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 -mr-1.5 -mt-1.5 rounded-lg text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto">
          <label className="block">
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,video/ogg"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
            <span className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-[var(--border)] rounded-lg text-sm font-medium text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] cursor-pointer transition-colors">
              {uploading ? "Uploading…" : "Choose file (image or video)"}
            </span>
          </label>

          {error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="mt-4 space-y-2">
            {loadingList ? (
              <p className="text-xs text-[var(--muted)]">Loading…</p>
            ) : assets.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">No assets yet</p>
            ) : (
              assets.map((a) => (
                <div
                  key={a.url}
                  className="flex items-center gap-3 p-2 rounded-lg bg-[var(--background)]"
                >
                  {a.url.match(/\.(jpg|jpeg|png|gif|webp|svg)/i) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt=""
                      className="w-12 h-12 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-[var(--border)] flex items-center justify-center text-xs text-[var(--muted)] flex-shrink-0">
                      video
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono truncate" title={a.name}>
                      {a.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => copyUrl(a.url)}
                      className="text-xs font-medium text-[var(--primary)] hover:underline"
                    >
                      {copied === a.url ? "Copied!" : "Copy URL"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
