"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateLandingPageSettings,
  updateLandingPagePricing,
  type PreviewType,
  type LandingPageCategory,
} from "@/lib/actions/landing-pages";
import { uploadPreviewPdf, uploadAsset } from "@/lib/actions/assets";
import { uploadZip, uploadStoryPdf } from "@/lib/actions/downloads";
import { Editor } from "./editor";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/rich-text-editor";
import { richTextToPlain } from "@/lib/html-sanitize";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatBytes(bytes?: number): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function fileNameFromUrl(url: string): string {
  try {
    const clean = url.split("?")[0];
    const seg = clean.substring(clean.lastIndexOf("/") + 1);
    return decodeURIComponent(seg) || "file";
  } catch {
    return "file";
  }
}

type FileMeta = { name: string; size?: number };

const PREVIEW_OPTIONS: { value: PreviewType; label: string; hint: string }[] = [
  { value: "html", label: "HTML editor", hint: "Pakai konten HTML/CSS/JS dari editor di bawah." },
  { value: "pdf", label: "PDF", hint: "Upload file PDF untuk di-embed di halaman preview." },
  { value: "link", label: "Link", hint: "Embed URL eksternal di halaman preview." },
];

type DeliverableType = "zip" | "pdf";

type Props = {
  pageId: string;
  slug: string;
  initialHtml: string;
  categories: LandingPageCategory[];
  initial: {
    title: string;
    preview_type: PreviewType;
    preview_url: string | null;
    price?: number | null;
    price_discount?: number | null;
    is_free?: boolean;
    featured?: boolean;
    thumbnail_url?: string | null;
    zip_url?: string | null;
    story_pdf_url?: string | null;
    category_id?: string | null;
    long_description?: string | null;
  };
};

/**
 * Single stateful form for the product edit page: page info (title + preview
 * source) and pricing/purchase, saved together from one sticky action bar. The
 * Monaco HTML editor keeps its own save (heavy, separate surface) and only shows
 * when the preview source is "HTML editor".
 */
export function ProductEditForm({ pageId, slug, initialHtml, categories, initial }: Props) {
  const router = useRouter();

  // --- Page info ---
  const [title, setTitle] = useState(initial.title);
  const [previewType, setPreviewType] = useState<PreviewType>(initial.preview_type);
  const [previewUrl, setPreviewUrl] = useState(initial.preview_url ?? "");
  const [pdfMeta, setPdfMeta] = useState<FileMeta | null>(
    initial.preview_type === "pdf" && initial.preview_url
      ? { name: fileNameFromUrl(initial.preview_url) }
      : null,
  );
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfDragging, setPdfDragging] = useState(false);

  // --- Pricing ---
  const [longDescription, setLongDescription] = useState(initial.long_description ?? "");
  const [isFree, setIsFree] = useState(!!initial.is_free);
  const [featured, setFeatured] = useState(!!initial.featured);
  const [price, setPrice] = useState(initial.price != null ? String(initial.price) : "");
  const [priceDiscount, setPriceDiscount] = useState(
    initial.price_discount != null ? String(initial.price_discount) : "",
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnail_url ?? "");
  const [thumbMeta, setThumbMeta] = useState<FileMeta | null>(
    initial.thumbnail_url ? { name: fileNameFromUrl(initial.thumbnail_url) } : null,
  );
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbDragging, setThumbDragging] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(initial.category_id ?? "");

  const [zipUrl, setZipUrl] = useState(initial.zip_url ?? "");
  const [zipMeta, setZipMeta] = useState<FileMeta | null>(
    initial.zip_url ? { name: fileNameFromUrl(initial.zip_url) } : null,
  );
  const [zipUploading, setZipUploading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  const [storyUrl, setStoryUrl] = useState(initial.story_pdf_url ?? "");
  const [storyMeta, setStoryMeta] = useState<FileMeta | null>(
    initial.story_pdf_url ? { name: fileNameFromUrl(initial.story_pdf_url) } : null,
  );
  const [storyUploading, setStoryUploading] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);

  // The buyer receives exactly one file: either a ZIP (downloaded) or a PDF
  // (read in the purchases list). Default to whichever already exists.
  const [deliverableType, setDeliverableType] = useState<DeliverableType>(
    initial.story_pdf_url && !initial.zip_url ? "pdf" : "zip",
  );

  // --- Action bar ---
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const pNum = parseFloat(price);
  const dNum = parseFloat(priceDiscount);
  const discountPct =
    !isFree && pNum > 0 && dNum > 0 && dNum < pNum ? Math.round((1 - dNum / pNum) * 100) : null;

  /* ---------------------------- Uploads ---------------------------------- */

  const uploadPdfFile = useCallback(
    async (file: File) => {
      if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setMessage({ type: "err", text: "File harus berformat PDF." });
        return;
      }
      setMessage(null);
      setPdfUploading(true);
      const formData = new FormData();
      formData.set("file", file);
      try {
        // Pass the current PDF so it's deleted once the new one is stored.
        const result = await uploadPreviewPdf(pageId, formData, previewUrl || null);
        if ("error" in result) {
          setMessage({ type: "err", text: result.error });
        } else {
          setPreviewUrl(result.url);
          setPdfMeta({ name: file.name, size: file.size });
          setMessage({ type: "ok", text: "PDF terupload. Klik Simpan perubahan untuk menerapkan." });
        }
      } finally {
        setPdfUploading(false);
      }
    },
    [pageId, previewUrl],
  );

  // Uploads only push the file to storage + set local state. Nothing is written
  // to the DB until the user clicks "Simpan perubahan" (handleSaveAll).
  async function handleZipUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipUploading(true);
    setZipError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      // Pass the current deliverable path so it's deleted once the new one is stored.
      const res = await uploadZip(pageId, formData, zipUrl || null);
      if ("error" in res) {
        setZipError(res.error);
        return;
      }
      setZipUrl(res.url);
      setZipMeta({ name: file.name, size: file.size });
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setZipUploading(false);
      e.target.value = "";
    }
  }

  function removeZip() {
    setZipUrl("");
    setZipMeta(null);
    setZipError(null);
  }

  async function handleStoryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoryUploading(true);
    setStoryError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      // Pass the current deliverable path so it's deleted once the new one is stored.
      const res = await uploadStoryPdf(pageId, formData, storyUrl || null);
      if ("error" in res) {
        setStoryError(res.error);
        return;
      }
      setStoryUrl(res.url);
      setStoryMeta({ name: file.name, size: file.size });
    } catch (err) {
      setStoryError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setStoryUploading(false);
      e.target.value = "";
    }
  }

  function removeStory() {
    setStoryUrl("");
    setStoryMeta(null);
    setStoryError(null);
  }

  const uploadThumbFile = useCallback(
    async (file: File) => {
      if (file.type && !file.type.startsWith("image/")) {
        setThumbError("File harus berupa gambar.");
        return;
      }
      setThumbUploading(true);
      setThumbError(null);
      const formData = new FormData();
      formData.set("file", file);
      try {
        // Pass the current thumbnail so it's deleted once the new one is stored.
        const res = await uploadAsset(pageId, formData, thumbnailUrl || null);
        if ("error" in res) {
          setThumbError(res.error);
        } else {
          setThumbnailUrl(res.url);
          setThumbMeta({ name: file.name, size: file.size });
        }
      } finally {
        setThumbUploading(false);
      }
    },
    [pageId, thumbnailUrl],
  );

  function removeThumb() {
    setThumbnailUrl("");
    setThumbMeta(null);
    setThumbError(null);
  }

  /* ---------------------------- Save / delete ---------------------------- */

  async function handleSaveAll() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setMessage({ type: "err", text: "Judul tidak boleh kosong." });
      return;
    }
    if ((previewType === "pdf" || previewType === "link") && !previewUrl.trim()) {
      setMessage({
        type: "err",
        text: previewType === "pdf" ? "Upload PDF dulu." : "Isi URL link dulu.",
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateLandingPageSettings(
        pageId,
        {
          title: trimmedTitle,
          preview_type: previewType,
          preview_url: previewType === "html" ? null : previewUrl.trim(),
        },
        slug,
      );
      await updateLandingPagePricing(pageId, {
        price: isFree ? null : price ? parseFloat(price) : null,
        price_discount: isFree || !priceDiscount ? null : parseFloat(priceDiscount),
        is_free: isFree,
        purchase_link: null,
        purchase_type: "internal",
        featured,
        thumbnail_url: thumbnailUrl.trim() || null,
        zip_url: deliverableType === "zip" ? zipUrl.trim() || null : null,
        story_pdf_url: deliverableType === "pdf" ? storyUrl.trim() || null : null,
        category_id: categoryId.trim() || null,
        long_description: longDescription.trim() || null,
      });
      setMessage({ type: "ok", text: "Perubahan tersimpan." });
      router.refresh();
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Gagal menyimpan" });
    } finally {
      setSaving(false);
    }
  }

  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-6 pb-4">
      {/* ===================== Card 1: Informasi halaman landing =============== */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-5 sm:p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Informasi halaman landing</h2>
          <p className="text-sm text-[var(--muted)]">Atur konten dan tampilan halaman produk Anda.</p>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="page-title" className="block text-sm font-medium text-foreground">
            Judul (Title)
          </label>
          <input
            id="page-title"
            type="text"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            placeholder="Judul landing page"
          />
          <p className="text-right text-xs text-[var(--muted)]">{title.length}/100</p>
        </div>

        {/* Preview source */}
        <div className="space-y-2">
          <span className="block text-sm font-medium text-foreground">Sumber preview</span>
          <div className="inline-flex flex-wrap gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--background)] p-1">
            {PREVIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPreviewType(opt.value)}
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

        {/* PDF upload */}
        {previewType === "pdf" && (
          <div className="space-y-3">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPdfFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setPdfDragging(true);
              }}
              onDragLeave={() => setPdfDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setPdfDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) uploadPdfFile(f);
              }}
              className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                pdfDragging
                  ? "border-[var(--primary)] bg-[var(--primary)]/5"
                  : "border-[var(--border)] hover:border-[var(--primary)]/60"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-[var(--primary)]">
                <FileTextIcon className="h-4 w-4" />
                {pdfUploading ? "Mengupload…" : previewUrl ? "Ganti file PDF" : "Pilih file PDF"}
              </span>
              <span className="text-xs text-[var(--muted)]">Klik atau drag &amp; drop file PDF di sini</span>
            </button>

            {previewUrl && (
              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-xs font-bold text-red-600 dark:text-red-400">
                  PDF
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {pdfMeta?.name ?? fileNameFromUrl(previewUrl)}
                  </p>
                  {formatBytes(pdfMeta?.size) && (
                    <p className="text-xs text-[var(--muted)]">{formatBytes(pdfMeta?.size)}</p>
                  )}
                </div>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka PDF"
                  aria-label="Buka PDF"
                  className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-foreground"
                >
                  <ExternalIcon className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl("");
                    setPdfMeta(null);
                  }}
                  title="Hapus PDF"
                  aria-label="Hapus PDF"
                  className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* External link */}
        {previewType === "link" && (
          <div className="space-y-1.5">
            <label htmlFor="preview-link" className="block text-sm font-medium text-foreground">
              URL link
            </label>
            <input
              id="preview-link"
              type="url"
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              placeholder="https://contoh.com/halaman"
            />
          </div>
        )}
      </section>

      {/* Monaco editor — only for the HTML preview source. Keeps its own save. */}
      {previewType === "html" && (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm sm:p-4">
          <Editor id={pageId} initialHtml={initialHtml} />
        </div>
      )}

      {/* ===================== Card 2: Pricing & Purchase ===================== */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-5 sm:p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Pricing &amp; Purchase</h2>
          <p className="text-sm text-[var(--muted)]">
            Atur harga, file yang akan dikirim setelah pembelian, dan tampilan produk di homepage.
          </p>
        </div>

        {/* Long description — rich text (WYSIWYG). Stored as HTML, sanitized on save. */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-foreground">
              Deskripsi panjang <span className="text-[var(--muted)]">(tampil di kartu &amp; checkout)</span>
            </span>
            <span className="hidden text-xs text-[var(--muted)] sm:block">
              Bantu pembeli memahami isi produk Anda.
            </span>
          </div>
          <RichTextEditor
            initialHtml={initial.long_description ?? ""}
            onChange={setLongDescription}
            placeholder="Penjelasan produk, fitur, atau manfaat…"
          />
          <p className="text-right text-xs text-[var(--muted)]">
            {richTextToPlain(longDescription).length} karakter
          </p>
        </div>

        {/* Toggle cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard
            checked={isFree}
            onChange={setIsFree}
            title="Gratis (Free)"
            description="Produk ini dapat diakses secara gratis"
          />
          <ToggleCard
            checked={featured}
            onChange={setFeatured}
            title="Pin produk di homepage"
            description="Tampilkan produk ini di bagian paling depan"
          />
        </div>

        {/* Prices */}
        {!isFree && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Normal price (IDR)</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-[var(--border)] px-3 text-sm text-[var(--muted)]">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="300.000"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2.5 pl-12 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Discount price (IDR)</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-[var(--border)] px-3 text-sm text-[var(--muted)]">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={priceDiscount}
                  onChange={(e) => setPriceDiscount(e.target.value)}
                  placeholder="50.000"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2.5 pl-12 pr-20 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                />
                {discountPct != null && (
                  <span className="absolute inset-y-0 right-2 my-auto flex h-6 items-center rounded-md bg-[var(--primary)]/10 px-2 text-xs font-semibold text-[var(--primary)]">
                    {discountPct}% OFF
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Deliverable — buyer receives one file, either ZIP or PDF. */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">File yang diberikan ke pembeli</h3>
            <p className="text-xs text-[var(--muted)]">File akan tersedia setelah pembayaran berhasil.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="deliverable-type" className="block text-sm font-medium text-foreground">
              Tipe file
            </label>
            <select
              id="deliverable-type"
              value={deliverableType}
              onChange={(e) => setDeliverableType(e.target.value as DeliverableType)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 sm:max-w-xs"
            >
              <option value="zip">ZIP — file untuk di-download pembeli</option>
              <option value="pdf">PDF — dibaca pembeli di daftar pembelian</option>
            </select>
            <p className="text-xs text-[var(--muted)]">
              {deliverableType === "zip"
                ? "Pembeli mengunduh file ZIP setelah pembayaran berhasil."
                : "Pembeli membaca file PDF langsung dari daftar pembelian."}
            </p>
          </div>

          {deliverableType === "zip" ? (
            <FileUploadCard
              label="File ZIP (untuk download setelah pembayaran)"
              accept=".zip,application/zip,application/x-zip-compressed"
              badge="ZIP"
              badgeClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              url={zipUrl}
              meta={zipMeta}
              uploading={zipUploading}
              error={zipError}
              statusText="ZIP terpasang"
              onUpload={handleZipUpload}
              onRemove={removeZip}
            />
          ) : (
            <FileUploadCard
              label="File PDF (dibaca customer di daftar pembelian)"
              accept=".pdf,application/pdf"
              badge="PDF"
              badgeClass="bg-red-500/10 text-red-600 dark:text-red-400"
              url={storyUrl}
              meta={storyMeta}
              uploading={storyUploading}
              error={storyError}
              statusText="PDF terpasang"
              onUpload={handleStoryUpload}
              onRemove={removeStory}
            />
          )}
        </div>

        {/* Thumbnail */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-foreground">
            Thumbnail <span className="text-[var(--muted)]">(untuk preview di homepage)</span>
          </span>
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
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  disabled={thumbUploading}
                  className="text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
                >
                  {thumbUploading ? "Mengupload…" : "Ganti gambar"}
                </button>
              </div>
              <button
                type="button"
                onClick={removeThumb}
                title="Hapus thumbnail"
                aria-label="Hapus thumbnail"
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
                {thumbUploading ? "Mengupload…" : "Pilih gambar"}
              </span>
              <span className="text-xs text-[var(--muted)]">Klik atau drag &amp; drop gambar di sini</span>
            </button>
          )}
          {thumbError && <p className="text-xs text-red-500">{thumbError}</p>}
        </div>

        {/* Category + display info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="category" className="block text-sm font-medium text-foreground">
              Kategori
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            >
              <option value="">— Pilih kategori —</option>
              {categories
                .filter((c) => !c.parent_id)
                .map((parent) => {
                  const children = categories.filter((c) => c.parent_id === parent.id);
                  if (children.length === 0) {
                    return (
                      <option key={parent.id} value={parent.id}>
                        {parent.name}
                      </option>
                    );
                  }
                  return (
                    <optgroup key={parent.id} label={parent.name}>
                      <option value={parent.id}>{parent.name} — semua</option>
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
            </select>
            <p className="text-xs text-[var(--muted)]">
              Pilih kategori yang paling sesuai dengan produk Anda.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <StoreIcon className="h-4 w-4 text-[var(--primary)]" />
              Bagaimana produk ini akan ditampilkan?
            </p>
            <ul className="space-y-1.5 text-xs text-[var(--muted)]">
              <CheckItem>Judul &amp; deskripsi tampil di kartu produk</CheckItem>
              <CheckItem>Harga diskon akan ditampilkan (jika ada)</CheckItem>
              <CheckItem>Thumbnail tampil di homepage</CheckItem>
              {featured && <CheckItem>Produk akan di-pin di bagian paling depan</CheckItem>}
            </ul>
          </div>
        </div>
      </section>

      {/* ===================== Sticky action bar ============================== */}
      <div className="sticky bottom-3 z-10 flex items-center justify-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)]/95 px-3 py-2 shadow-lg backdrop-blur sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {message && (
            <span
              className={`truncate text-sm ${
                message.type === "ok"
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {message.text}
            </span>
          )}
          <Button variant="secondary" onClick={() => router.push("/panel/products")} disabled={saving} className="hidden sm:inline-flex">
            Batal
          </Button>
          <Button onClick={handleSaveAll} loading={saving} disabled={saving} className="shrink-0">
            {saving ? "Menyimpan…" : (
              <>
                <span className="sm:hidden">Simpan</span>
                <span className="hidden sm:inline">Simpan perubahan</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function ToggleCard({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
        checked
          ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/30"
          : "border-[var(--border)] hover:bg-[var(--background)]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--primary)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-[var(--muted)]">{description}</span>
      </span>
    </label>
  );
}

function FileUploadCard({
  label,
  accept,
  badge,
  badgeClass,
  url,
  meta,
  uploading,
  error,
  statusText,
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
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] p-3">
      <p className="mb-2 text-xs font-medium text-[var(--muted)]">{label}</p>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onUpload} disabled={uploading} />

      {url ? (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${badgeClass}`}>
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

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
      <span>{children}</span>
    </li>
  );
}

/* --------------------------------- Icons ---------------------------------- */

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
    </svg>
  );
}

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
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

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l1-5h16l1 5M4 9v10a1 1 0 001 1h14a1 1 0 001-1V9M4 9h16M9 20v-6h6v6" />
    </svg>
  );
}
