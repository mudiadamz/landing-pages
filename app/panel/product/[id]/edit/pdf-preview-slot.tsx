"use client";

import { useCallback, useRef, useState } from "react";
import { fileNameFromUrl, formatBytes, type FileMeta } from "@/components/file-upload-card";
import { uploadPreviewPdfClient } from "@/lib/upload-client";
import { ExternalIcon, FileTextIcon, TrashIcon } from "./icons";
import { useT } from "@/lib/i18n/client";

/**
 * One PDF slot — drop zone when empty, file row when filled.
 *
 * Owns its own uploading/dragging state because the preview tab has two of
 * these side by side (light and dark), and they must be able to be busy
 * independently.
 */

export function PdfPreviewSlot({
  label,
  hint,
  pageId,
  url,
  meta,
  onUploaded,
  onClear,
  onError,
}: {
  label: string;
  hint?: string;
  pageId: string;
  url: string;
  meta: FileMeta | null;
  onUploaded: (url: string, meta: FileMeta) => void;
  onClear: () => void;
  onError: (text: string) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        onError(t("product.pdfOnly"));
        return;
      }
      setUploading(true);
      try {
        // Pass the current PDF so it's deleted once the new one is stored.
        const result = await uploadPreviewPdfClient(pageId, file, url || null);
        if ("error" in result) {
          onError(result.error);
        } else {
          onUploaded(result.url, { name: file.name, size: file.size });
        }
      } finally {
        setUploading(false);
      }
    },
    [pageId, url, onUploaded, onError],
  );

  return (
    <div className="space-y-2">
      <div>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging
            ? "border-[var(--primary)] bg-[var(--primary)]/5"
            : "border-[var(--border)] hover:border-[var(--primary)]/60"
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
          <FileTextIcon className="h-4 w-4" />
          {uploading ? t("product.uploading") : url ? t("product.replacePdf") : t("product.pickPdf")}
        </span>
        <span className="text-xs text-[var(--muted)]">{t("product.dropPdf")}</span>
      </button>

      {url && (
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-xs font-bold text-red-600 dark:text-red-400">
            PDF
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {meta?.name ?? fileNameFromUrl(url)}
            </p>
            {formatBytes(meta?.size) && (
              <p className="text-xs text-[var(--muted)]">{formatBytes(meta?.size)}</p>
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={t("product.openPdf")}
            aria-label={t("product.openPdf")}
            className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-foreground"
          >
            <ExternalIcon className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClear}
            title={t("product.removePdf")}
            aria-label={t("product.removePdf")}
            className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
