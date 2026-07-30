"use client";

import { useRef } from "react";

/**
 * The upload control for this panel. Every file input in the panel uses it.
 *
 * Extracted from app/panel/product/[id]/edit/product-edit-form.tsx, where it
 * was defined privately and used five times. A second bare <input type="file">
 * had already appeared elsewhere and looked nothing like it, so the shape is
 * now shared rather than re-implemented per screen.
 *
 * Two states: empty shows a dashed drop-target button; filled shows the file
 * name, size, a remove control and a "Ganti file" link. Errors render beneath
 * either state.
 */

export type FileMeta = { name: string; size?: number };

export function formatBytes(bytes?: number): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function fileNameFromUrl(url: string): string {
  try {
    const clean = url.split("?")[0];
    const seg = clean.substring(clean.lastIndexOf("/") + 1);
    return decodeURIComponent(seg) || "file";
  } catch {
    return "file";
  }
}

export function FileUploadCard({
  label,
  accept,
  badge,
  badgeClass,
  url,
  meta,
  uploading,
  error,
  statusText,
  hint,
  preview,
  onUpload,
  onRemove,
}: {
  label: string;
  accept: string;
  badge: string;
  badgeClass: string;
  url: string;
  meta: FileMeta | null;
  uploading: boolean;
  error: string | null;
  statusText: string;
  /** Optional line under the label — constraints like format or max size. */
  hint?: string;
  /** Optional thumbnail rendered above the file row when something is set. */
  preview?: React.ReactNode;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] p-3">
      <p className="mb-0.5 text-xs font-medium text-[var(--muted)]">{label}</p>
      {hint && <p className="mb-2 text-[11px] text-[var(--muted)]">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onUpload}
        disabled={uploading}
      />

      {url ? (
        <>
          {preview}
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${badgeClass}`}
            >
              {badge}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {meta?.name ?? fileNameFromUrl(url)}
              </p>
              {formatBytes(meta?.size) && (
                <p className="text-xs text-[var(--muted)]">{formatBytes(meta?.size)}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onRemove}
              title="Hapus file"
              aria-label="Hapus file"
              className="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <CheckIcon className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
            <span className="text-xs text-green-600 dark:text-green-400">{statusText}</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="ml-auto text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
            >
              {uploading ? "Mengupload…" : "Ganti file"}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--border)] px-3 py-5 text-center transition-colors hover:border-[var(--primary)]/60 disabled:opacity-50"
        >
          <span className="text-sm font-medium text-[var(--primary)]">
            {uploading ? "Mengupload…" : "Pilih file"}
          </span>
          <span className="text-xs text-[var(--muted)]">Klik untuk upload</span>
        </button>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
