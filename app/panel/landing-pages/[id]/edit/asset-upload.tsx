"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { uploadAsset, listAssets } from "@/lib/actions/assets";

export function AssetUpload({ pageId }: { pageId: string }) {
  const router = useRouter();
  const [assets, setAssets] = useState<{ name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

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

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
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
