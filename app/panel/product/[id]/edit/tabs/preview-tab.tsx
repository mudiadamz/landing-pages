"use client";

import { FileUploadCard, type FileMeta } from "@/components/file-upload-card";
import type { PreviewType } from "@/lib/actions/landing-pages";
import type { DeliverableType } from "../deliverable-type";
import { Editor } from "../editor";
import { CutPercentField } from "../cut-percent-field";
import { PdfPreviewSlot } from "../pdf-preview-slot";
import { PREVIEW_OPTIONS } from "../preview-options";
import { useT } from "@/lib/i18n/client";
import { PresetTextField } from "../preset-text-field";
import {
  DEFAULT_PREVIEW_LABEL,
  PREVIEW_LABEL_MAX,
  PREVIEW_LABEL_PRESETS,
} from "@/lib/preview-label";

/**
 * What a visitor can see before paying.
 *
 * This tab reaches into the delivery tab's state on purpose: two of the six
 * preview modes ("deliverable" and "excerpt") show the buyer's own file, so the
 * upload slots have to be the same ones — not a second copy that could drift
 * out of sync with what actually ships.
 */
export function PreviewTab({
  className,
  pageId,
  initialHtml,
  previewType,
  pickPreviewType,
  previewUrl,
  setPreviewUrl,
  previewUrlDark,
  setPreviewUrlDark,
  pdfMeta,
  setPdfMeta,
  pdfMetaDark,
  setPdfMetaDark,
  epubMeta,
  epubUploading,
  epubError,
  handlePreviewEpubUpload,
  removePreviewEpub,
  deliverableType,
  setDeliverableType,
  storyUrl,
  storyMeta,
  storyUploading,
  storyError,
  handleStoryUpload,
  removeStory,
  storyEpubUrl,
  storyEpubMeta,
  storyEpubUploading,
  storyEpubError,
  handleStoryEpubUpload,
  removeStoryEpub,
  cutPercent,
  setCutPercent,
  purging,
  purged,
  runPurge,
  previewLabel,
  setPreviewLabel,
  setMessage,
}: {
  className: string;
  pageId: string;
  initialHtml: string;
  previewType: PreviewType;
  pickPreviewType: (next: PreviewType) => void;
  previewUrl: string;
  setPreviewUrl: (v: string) => void;
  previewUrlDark: string;
  setPreviewUrlDark: (v: string) => void;
  pdfMeta: FileMeta | null;
  setPdfMeta: (v: FileMeta | null) => void;
  pdfMetaDark: FileMeta | null;
  setPdfMetaDark: (v: FileMeta | null) => void;
  epubMeta: FileMeta | null;
  epubUploading: boolean;
  epubError: string | null;
  handlePreviewEpubUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removePreviewEpub: () => void;
  deliverableType: DeliverableType;
  setDeliverableType: (v: DeliverableType) => void;
  storyUrl: string;
  storyMeta: FileMeta | null;
  storyUploading: boolean;
  storyError: string | null;
  handleStoryUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeStory: () => void;
  storyEpubUrl: string;
  storyEpubMeta: FileMeta | null;
  storyEpubUploading: boolean;
  storyEpubError: string | null;
  handleStoryEpubUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeStoryEpub: () => void;
  cutPercent: number;
  setCutPercent: (v: number) => void;
  purging: boolean;
  purged: string | null;
  runPurge: () => void;
  previewLabel: string;
  setPreviewLabel: (v: string) => void;
  setMessage: (m: { type: "ok" | "err"; text: string } | null) => void;
}) {
  const t = useT();
  return (
  <section className={className}>
    <div>
      <h2 className="text-base font-semibold text-foreground">{t("product.previewHeading")}</h2>
      <p className="text-sm text-[var(--muted)]">{t("product.previewIntro")}</p>
    </div>

    {/* Preview source */}
    <div className="space-y-2">
      <span className="block text-sm font-medium text-foreground">{t("product.previewSource")}</span>
      <div className="inline-flex flex-wrap gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--background)] p-1">
        {PREVIEW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => pickPreviewType(opt.value)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              previewType === opt.value
                ? "bg-[var(--card)] text-foreground shadow-sm ring-1 ring-[var(--border)]"
                : "text-[var(--muted)] hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--muted)]">
        {PREVIEW_OPTIONS.find((o) => o.value === previewType)?.hint}
      </p>
    </div>

    {/* PDF upload — light + optional dark variant. */}
    {previewType === "pdf" && (
      <div className="space-y-4">
        <p className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
          {t("product.previewPdfBefore")} <strong className="text-foreground">{t("product.light")}</strong> &amp;{" "}
          <strong className="text-foreground">{t("product.dark")}</strong>{" "}
          {t("product.previewPdfAfter")}
        </p>
        <PdfPreviewSlot
          label={t("product.previewPdfLight")}
          pageId={pageId}
          url={previewUrl}
          meta={pdfMeta}
          onUploaded={(url, meta) => {
            setPreviewUrl(url);
            setPdfMeta(meta);
            setMessage({ type: "ok", text: t("product.pdfUploaded") });
          }}
          onClear={() => {
            setPreviewUrl("");
            setPdfMeta(null);
          }}
          onError={(text) => setMessage({ type: "err", text })}
        />
        <PdfPreviewSlot
          label={t("product.previewPdfDark")}
          hint={t("product.previewPdfDarkHint")}
          pageId={pageId}
          url={previewUrlDark}
          meta={pdfMetaDark}
          onUploaded={(url, meta) => {
            setPreviewUrlDark(url);
            setPdfMetaDark(meta);
            setMessage({ type: "ok", text: t("product.pdfDarkUploaded") });
          }}
          onClear={() => {
            setPreviewUrlDark("");
            setPdfMetaDark(null);
          }}
          onError={(text) => setMessage({ type: "err", text })}
        />
      </div>
    )}

    {/* EPUB preview — single file, themed in-reader. */}
    {previewType === "epub" && (
      <div className="space-y-2">
        <p className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
          {t("product.previewEpubBefore")} <strong className="text-foreground">{t("product.light")}</strong> /{" "}
          <strong className="text-foreground">{t("product.dark")}</strong>{" "}
          {t("product.previewEpubAfter")}
        </p>
        <FileUploadCard
          label={t("product.previewEpubLabel")}
          accept=".epub,application/epub+zip"
          badge="EPUB"
          badgeClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          url={previewUrl}
          meta={epubMeta}
          uploading={epubUploading}
          error={epubError}
          statusText={t("product.deliveryEpubReady")}
          onUpload={handlePreviewEpubUpload}
          onRemove={removePreviewEpub}
        />
      </div>
    )}

    {/* Cache purge — every preview type, not just excerpts. The chapter,
        cover and asset endpoints are all cached hard at the edge. */}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{t("product.cacheHeading")}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {t("product.cacheHint")}
        </p>
      </div>
      <button
        type="button"
        onClick={runPurge}
        disabled={purging}
        className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-[var(--primary)] disabled:opacity-60"
      >
        {purging ? t("product.purging") : t("product.purge")}
      </button>
      {purged && (
        <p className="w-full text-xs text-[var(--muted)]">{purged}</p>
      )}
    </div>

    {/* Preview reads the buyer's own file. The upload card lives HERE, not
        behind a "go to the Pengiriman tab" instruction — it's the same state,
        so editing it in either tab is the same edit. */}
    {(previewType === "deliverable" || previewType === "excerpt") && (
      <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("product.buyerFile")}</h3>
          <p className="text-xs text-[var(--muted)]">
            {previewType === "excerpt" ? (
              <>
                {t("product.excerptExplainBefore")}{" "}
                <strong className="text-foreground">{t("product.excerptSameFile")}</strong>{" "}
                {t("product.excerptExplainAfter")}
              </>
            ) : (
              <>{t("product.deliverableExplain")}</>
            )}{" "}
            {t("product.sameCardAs")}{" "}
            <strong className="text-foreground">{t("product.tabDelivery")}</strong>.
          </p>
        </div>

        {previewType === "excerpt" && deliverableType !== "epub" ? (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("product.buyerFileIsNow")}{" "}
              <strong>{deliverableType === "zip" ? "ZIP" : "PDF"}</strong>.{" "}
              {t("product.excerptNeedsEpub")}
            </p>
            <button
              type="button"
              onClick={() => setDeliverableType("epub")}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[var(--primary)]"
            >
              {t("product.switchToEpub")}
            </button>
          </div>
        ) : previewType === "deliverable" && deliverableType === "zip" ? (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("product.buyerFileIsNow")} <strong>ZIP</strong>, {t("product.zipNotPreviewable")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeliverableType("epub")}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[var(--primary)]"
              >
                {t("product.switchToEpub")}
              </button>
              <button
                type="button"
                onClick={() => setDeliverableType("pdf")}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[var(--primary)]"
              >
                {t("product.switchToPdf")}
              </button>
            </div>
          </div>
        ) : deliverableType === "epub" ? (
          <FileUploadCard
            label={t("product.deliveryEpubLabel")}
            accept=".epub,application/epub+zip"
            badge="EPUB"
            badgeClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            url={storyEpubUrl}
            meta={storyEpubMeta}
            uploading={storyEpubUploading}
            error={storyEpubError}
            statusText={t("product.deliveryEpubReady")}
            onUpload={handleStoryEpubUpload}
            onRemove={removeStoryEpub}
          />
        ) : (
          <FileUploadCard
            label={t("product.buyerPdfLabel")}
            accept=".pdf,application/pdf"
            badge="PDF"
            badgeClass="bg-red-500/10 text-red-600 dark:text-red-400"
            url={storyUrl}
            meta={storyMeta}
            uploading={storyUploading}
            error={storyError}
            statusText={t("product.deliveryPdfLightReady")}
            onUpload={handleStoryUpload}
            onRemove={removeStory}
          />
        )}

        {previewType === "excerpt" && deliverableType === "epub" && storyEpubUrl.trim() && (
          <CutPercentField value={cutPercent} onChange={setCutPercent} />
        )}
      </div>
    )}

    {/* External link */}
    {previewType === "link" && (
      <div className="space-y-1.5">
        <label htmlFor="preview-link" className="block text-sm font-medium text-foreground">
          {t("product.previewUrlLabel")}
        </label>
        <input
          id="preview-link"
          type="url"
          value={previewUrl}
          onChange={(e) => setPreviewUrl(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          placeholder={t("product.previewUrlPlaceholder")}
        />
      </div>
    )}

    {/* Label of the "Preview" button shown on the checkout page. */}
    <div className="sm:max-w-xs">
      <PresetTextField
        id="preview-label"
        label={t("product.previewLabelField")}
        value={previewLabel}
        onChange={setPreviewLabel}
        options={PREVIEW_LABEL_PRESETS}
        placeholder={DEFAULT_PREVIEW_LABEL}
        maxLength={PREVIEW_LABEL_MAX}
        hint={t("product.previewLabelHint")}
      />
    </div>

    {/* Monaco editor — only for the HTML preview source. Keeps its own save. */}
    {previewType === "html" && (
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 sm:p-4">
        <Editor id={pageId} initialHtml={initialHtml} />
      </div>
    )}
  </section>  );
}
