"use client";

import { fileNameFromUrl, formatBytes, type FileMeta } from "@/components/file-upload-card";
import { ImageIcon, TrashIcon } from "../icons";
import { t } from "@/lib/i18n";

/**
 * The three image slots: the portrait thumbnail every product needs, an
 * optional landscape crop for wide cards, and up to two extra shots.
 *
 * Each slot keeps its own uploading/error/dragging state rather than sharing
 * one set — two uploads can be in flight at once, and a shared "uploading" flag
 * would grey out the slot the person is not waiting on.
 */
export function ThumbnailTab({
  className,
  title,
  thumbnailUrl,
  thumbMeta,
  thumbUploading,
  thumbError,
  thumbDragging,
  setThumbDragging,
  thumbInputRef,
  uploadThumbFile,
  removeThumb,
  thumbWideUrl,
  thumbWideMeta,
  thumbWideUploading,
  thumbWideError,
  thumbWideDragging,
  setThumbWideDragging,
  thumbWideInputRef,
  uploadThumbWideFile,
  removeThumbWide,
  extraUrls,
  extraSizes,
  extraUploading,
  extraError,
  extraInputRef,
  uploadExtraFile,
  removeExtra,
}: {
  className: string;
  title: string;
  thumbnailUrl: string;
  thumbMeta: FileMeta | null;
  thumbUploading: boolean;
  thumbError: string | null;
  thumbDragging: boolean;
  setThumbDragging: (v: boolean) => void;
  thumbInputRef: React.RefObject<HTMLInputElement | null>;
  uploadThumbFile: (file: File) => Promise<void>;
  removeThumb: () => void;
  thumbWideUrl: string;
  thumbWideMeta: FileMeta | null;
  thumbWideUploading: boolean;
  thumbWideError: string | null;
  thumbWideDragging: boolean;
  setThumbWideDragging: (v: boolean) => void;
  thumbWideInputRef: React.RefObject<HTMLInputElement | null>;
  uploadThumbWideFile: (file: File) => Promise<void>;
  removeThumbWide: () => void;
  extraUrls: string[];
  extraSizes: Record<string, number>;
  extraUploading: boolean;
  extraError: string | null;
  extraInputRef: React.RefObject<HTMLInputElement | null>;
  uploadExtraFile: (file: File) => Promise<void>;
  removeExtra: (url: string) => void;
}) {
  return (
  <section className={className}>
    <div>
      <h2 className="text-base font-semibold text-foreground">{t("product.thumbHeading")}</h2>
      <p className="text-sm text-[var(--muted)]">
        {t("product.thumbIntro")}
      </p>
    </div>

    {/* Main thumbnail — the only mandatory image. */}
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-foreground">
        {t("product.thumbMain")} <span className="text-red-500">*</span>{" "}
        <span className="text-[var(--muted)]">{t("product.thumbMainWhere")}</span>
      </span>
      <p className="text-xs text-[var(--muted)]">
        {t("product.thumbMainHint")}
      </p>
      <input
        ref={thumbInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadThumbFile(f);
          e.target.value = "";
        }}
      />
      {thumbnailUrl.trim() ? (
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {thumbMeta?.name ?? fileNameFromUrl(thumbnailUrl)}
            </p>
            {formatBytes(thumbMeta?.size) && (
              <p className="text-xs text-[var(--muted)]">{formatBytes(thumbMeta?.size)}</p>
            )}
            <button
              type="button"
              onClick={() => thumbInputRef.current?.click()}
              disabled={thumbUploading}
              className="text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
            >
              {thumbUploading ? t("product.uploading") : t("product.replaceImage")}
            </button>
          </div>
          <button
            type="button"
            onClick={removeThumb}
            title={t("product.removeThumb")}
            aria-label={t("product.removeThumb")}
            className="shrink-0 rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => thumbInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setThumbDragging(true);
          }}
          onDragLeave={() => setThumbDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setThumbDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) uploadThumbFile(f);
          }}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            thumbDragging
              ? "border-[var(--primary)] bg-[var(--primary)]/5"
              : "border-[var(--border)] hover:border-[var(--primary)]/60"
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
            <ImageIcon className="h-4 w-4" />
            {thumbUploading ? t("product.uploading") : t("product.pickImage")}
          </span>
          <span className="text-xs text-[var(--muted)]">{t("product.dropImage")}</span>
        </button>
      )}
      {thumbError && <p className="text-xs text-red-500">{thumbError}</p>}
    </div>

    {/* Landscape thumbnail — used by the 16:9 cards in listings. */}
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-foreground">
        {t("product.thumbWide")}{" "}
        <span className="text-[var(--muted)]">{t("product.thumbWideWhere")}</span>
      </span>
      <p className="text-xs text-[var(--muted)]">
        {t("product.thumbWideHint")}
      </p>
      <input
        ref={thumbWideInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadThumbWideFile(f);
          e.target.value = "";
        }}
      />
      {thumbWideUrl.trim() ? (
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
          <span className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbWideUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {thumbWideMeta?.name ?? fileNameFromUrl(thumbWideUrl)}
            </p>
            {formatBytes(thumbWideMeta?.size) && (
              <p className="text-xs text-[var(--muted)]">{formatBytes(thumbWideMeta?.size)}</p>
            )}
            <button
              type="button"
              onClick={() => thumbWideInputRef.current?.click()}
              disabled={thumbWideUploading}
              className="text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
            >
              {thumbWideUploading ? t("product.uploading") : t("product.replaceImage")}
            </button>
          </div>
          <button
            type="button"
            onClick={removeThumbWide}
            title={t("product.removeThumbWide")}
            aria-label={t("product.removeThumbWide")}
            className="shrink-0 rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => thumbWideInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setThumbWideDragging(true);
          }}
          onDragLeave={() => setThumbWideDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setThumbWideDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) uploadThumbWideFile(f);
          }}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            thumbWideDragging
              ? "border-[var(--primary)] bg-[var(--primary)]/5"
              : "border-[var(--border)] hover:border-[var(--primary)]/60"
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
            <ImageIcon className="h-4 w-4" />
            {thumbWideUploading ? t("product.uploading") : t("product.pickImageWide")}
          </span>
          <span className="text-xs text-[var(--muted)]">{t("product.thumbWideRatio")}</span>
        </button>
      )}
      {thumbWideError && <p className="text-xs text-red-500">{thumbWideError}</p>}
    </div>

    {/* Extra images — become swipeable slides on the checkout page. */}
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-foreground">
        {t("product.thumbExtra")}{" "}
        <span className="text-[var(--muted)]">{t("product.thumbExtraWhere")}</span>
      </span>
      <p className="text-xs text-[var(--muted)]">
        {t("product.thumbExtraHint")}
      </p>
      <input
        ref={extraInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadExtraFile(f);
          e.target.value = "";
        }}
      />
      {extraUrls.length > 0 && (
        <ul className="space-y-2">
          {extraUrls.map((u, i) => (
            <li
              key={u}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5"
            >
              <span className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {fileNameFromUrl(u)}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  Slide {i + 2}
                  {formatBytes(extraSizes[u]) ? ` · ${formatBytes(extraSizes[u])}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeExtra(u)}
                title={t("product.removeImage")}
                aria-label={t("product.removeImage")}
                className="shrink-0 rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {extraUrls.length < 2 && (
        <button
          type="button"
          onClick={() => extraInputRef.current?.click()}
          disabled={extraUploading}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--border)] px-4 py-6 text-center transition-colors hover:border-[var(--primary)]/60 disabled:opacity-60"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
            <ImageIcon className="h-4 w-4" />
            {extraUploading ? t("product.uploading") : t("product.addImage")}
          </span>
          <span className="text-xs text-[var(--muted)]">
            {t("product.slotsLeft", { count: 2 - extraUrls.length })}
          </span>
        </button>
      )}
      {extraError && <p className="text-xs text-red-500">{extraError}</p>}
    </div>

  </section>  );
}
