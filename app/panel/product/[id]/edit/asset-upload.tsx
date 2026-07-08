"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { uploadAsset, listAssets, uploadSiteZip } from "@/lib/actions/assets";

export function AssetUpload({
  pageId,
  onSiteUploaded,
}: {
  pageId: string;
  onSiteUploaded?: (html: string) => void;
}) {
  const router = useRouter();
  const [assets, setAssets] = useState<{ name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipInfo, setZipInfo] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoadingList(true);
    try {
      const list = await listAssets(pageId);
      setAssets(list);
    } finally {
      setLoadingList(false);
    }
  }, [pageId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await uploadAsset(pageId, formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        await loadAssets();
        router.refresh();
      }
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipError(null);
    setZipInfo(null);
    setZipLoading(true);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await uploadSiteZip(pageId, formData);
      if ("error" in result) {
        setZipError(result.error);
      } else {
        setZipInfo(`${result.fileCount} file diupload • preview: ${result.indexPath}`);
        onSiteUploaded?.(result.html);
        router.refresh();
      }
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Failed to upload ZIP.");
    } finally {
      setZipLoading(false);
      e.target.value = "";
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3">Upload situs (.zip)</h3>
      <p className="text-xs text-[var(--muted)] mb-3">
        Berisi <code className="font-mono">index.html</code> beserta folder seperti{" "}
        <code className="font-mono">images/</code> dan <code className="font-mono">fonts/</code>.
        Semua file & folder otomatis terupload dan <code className="font-mono">index.html</code>{" "}
        dipakai sebagai preview.
      </p>

      <label className="block">
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleZipUpload}
          disabled={zipLoading}
          className="hidden"
        />
        <span className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-[var(--border)] rounded-lg text-sm font-medium text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] cursor-pointer transition-colors">
          {zipLoading ? "Mengupload & mengekstrak…" : "Pilih file .zip"}
        </span>
      </label>

      {zipError && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{zipError}</p>
      )}
      {zipInfo && (
        <p className="mt-2 text-xs text-green-600 dark:text-green-400">{zipInfo}</p>
      )}

      <div className="my-4 border-t border-[var(--border)]" />

      <h3 className="text-sm font-semibold text-foreground mb-3">Assets</h3>
      <p className="text-xs text-[var(--muted)] mb-3">
        Upload images or videos. Copy the URL and paste into your HTML.
      </p>

      <label className="block">
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,video/ogg"
          onChange={handleUpload}
          disabled={loading}
          className="hidden"
        />
        <span className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-[var(--border)] rounded-lg text-sm font-medium text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] cursor-pointer transition-colors">
          {loading ? "Uploading…" : "Choose file (image or video)"}
        </span>
      </label>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
        {loadingList ? (
          <p className="text-xs text-[var(--muted)]">Loading…</p>
        ) : assets.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No assets yet</p>
        ) : (
          assets.map((a) => (
            <div
              key={a.url}
              className="flex items-center gap-2 p-2 rounded-lg bg-[var(--background)]"
            >
              {a.url.match(/\.(jpg|jpeg|png|gif|webp|svg)/i) ? (
                <img
                  src={a.url}
                  alt=""
                  className="w-10 h-10 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-[var(--border)] flex items-center justify-center text-xs text-[var(--muted)] flex-shrink-0">
                  video
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono truncate" title={a.url}>
                  {a.name}
                </p>
                <button
                  type="button"
                  onClick={() => copyUrl(a.url)}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  Copy URL
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
