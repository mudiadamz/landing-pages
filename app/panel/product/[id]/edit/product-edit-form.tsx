"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { getStoredFileSizes } from "@/lib/actions/file-sizes";
import { DEFAULT_CUT_PERCENT, clampCutPercent } from "@/lib/epub-cut";
import { useRouter } from "next/navigation";
import {
  updateLandingPageSettings,
  updateLandingPagePricing,
  type PreviewType,
  type LandingPageCategory,
} from "@/lib/actions/landing-pages";
import {
  uploadPreviewPdfClient,
  uploadPreviewEpubClient,
  uploadThumbnailClient,
  uploadZipClient,
  uploadStoryPdfClient,
  uploadStoryEpubClient,
} from "@/lib/upload-client";
import { Editor } from "./editor";
import { Button } from "@/components/ui/button";
import { PresetTextField } from "./preset-text-field";
import {
  DEFAULT_PREVIEW_LABEL,
  PREVIEW_LABEL_MAX,
  PREVIEW_LABEL_PRESETS,
  previewLabelForEdit,
} from "@/lib/preview-label";
import { RichTextEditor } from "@/components/rich-text-editor";
import { richTextToPlain } from "@/lib/html-sanitize";
import {
  FileUploadCard,
  formatBytes,
  fileNameFromUrl,
  type FileMeta,
} from "@/components/file-upload-card";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */




const PREVIEW_OPTIONS: { value: PreviewType; label: string; hint: string }[] = [
  { value: "html", label: "HTML editor", hint: "Pakai konten HTML/CSS/JS dari editor di bawah." },
  { value: "pdf", label: "PDF", hint: "Upload file PDF untuk di-embed di halaman preview." },
  { value: "epub", label: "EPUB", hint: "Upload file EPUB — pembaca bisa ganti tema terang/gelap langsung di reader." },
  { value: "link", label: "Link", hint: "Embed URL eksternal di halaman preview." },
  {
    value: "deliverable",
    label: "Sama dgn deliverable",
    hint: "Preview memakai file pembeli (PDF/EPUB) yang sama — tak perlu upload lagi. Seluruh isi bisa dibaca gratis di preview.",
  },
  {
    value: "excerpt",
    label: "Sebagian deliverable",
    hint: "Satu file saja: preview menampilkan sebagian awal EPUB pembeli. Tidak ada file preview terpisah yang harus ikut diedit.",
  },
];


type DeliverableType = "zip" | "pdf" | "epub";

type TabKey = "detail" | "preview" | "harga" | "pengiriman" | "terkait";
const TABS: { key: TabKey; label: string }[] = [
  { key: "detail", label: "Detail" },
  { key: "preview", label: "Preview" },
  { key: "harga", label: "Harga" },
  { key: "pengiriman", label: "Pengiriman" },
  { key: "terkait", label: "Terkait" },
];
const PANEL_CLASS =
  "rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-5 sm:p-6 shadow-sm space-y-6";

type RelatedOption = { id: string; title: string; slug: string };

type Props = {
  pageId: string;
  slug: string;
  initialHtml: string;
  categories: LandingPageCategory[];
  /** The seller's other products, offered as "related product" choices. */
  relatedOptions: RelatedOption[];
  initial: {
    title: string;
    preview_type: PreviewType;
    preview_url: string | null;
    preview_url_dark?: string | null;
    preview_cut_percent?: number | null;
    price?: number | null;
    price_discount?: number | null;
    is_free?: boolean;
    featured?: boolean;
    thumbnail_url?: string | null;
    thumbnail_landscape_url?: string | null;
    thumbnail_extra_urls?: string[] | null;
    zip_url?: string | null;
    story_pdf_url?: string | null;
    story_pdf_url_dark?: string | null;
    story_epub_url?: string | null;
    category_id?: string | null;
    long_description?: string | null;
    preview_label?: string | null;
    cta_label?: string | null;
    cta_note?: string | null;
    purchase_link?: string | null;
    purchase_type?: "external" | "internal";
    cta_action?: "checkout" | "link" | "calendar" | null;
    event_title?: string | null;
    event_start?: string | null;
    event_end?: string | null;
    event_location?: string | null;
    event_description?: string | null;
    related_product_ids?: string[] | null;
    next_product_id?: string | null;
    bundle_product_ids?: string[] | null;
    bundle_note?: string | null;
    available_at?: string | null;
  };
};

/** ISO instant → value for a <input type="datetime-local"> (local wall time). */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * One PDF drop-zone + uploaded-file chip. Used twice (light + dark variants).
 * Self-contained: manages its own uploading/dragging state and deletes the file
 * it's replacing (passes its current url to uploadPreviewPdf). Local state only —
 * the parent persists the url on "Simpan perubahan".
 */
function PdfPreviewSlot({
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        onError("File harus berformat PDF.");
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
          {uploading ? "Mengupload…" : url ? "Ganti file PDF" : "Pilih file PDF"}
        </span>
        <span className="text-xs text-[var(--muted)]">Klik atau drag &amp; drop file PDF di sini</span>
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
            title="Buka PDF"
            aria-label="Buka PDF"
            className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-foreground"
          >
            <ExternalIcon className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClear}
            title="Hapus PDF"
            aria-label="Hapus PDF"
            className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Single stateful form for the product edit page: page info (title + preview
 * source) and pricing/purchase, saved together from one sticky action bar. The
 * Monaco HTML editor keeps its own save (heavy, separate surface) and only shows
 * when the preview source is "HTML editor".
 */

/* Ready-made CTA wording, so button copy stays consistent across products
   instead of being retyped each time. "Lainnya…" still allows anything. */
const BUNDLE_NOTES = [
  "Semua bagian sekaligus — lebih hemat.",
  "Paket lengkap, satu kali bayar.",
  "Hemat dibanding beli satuan.",
  "Langsung dapat semuanya, tanpa nunggu.",
  "Koleksi lengkap dalam satu paket.",
];

const CTA_LABELS_PAID = [
  "Beli sekarang",
  "Miliki sekarang",
  "Dapatkan sekarang",
  "Baca sekarang",
  "Download sekarang",
  "Checkout",
];
const CTA_LABELS_FREE = [
  "Ambil gratis",
  "Baca gratis",
  "Download gratis",
  "Mulai baca",
  "Dapatkan sekarang",
];
const CTA_LABELS_CALENDAR = [
  "Tambahkan ke kalender",
  "Simpan tanggalnya",
  "Ingatkan saya",
];
const CTA_NOTES_PAID = [
  "Miliki sekarang — akses penuh, selamanya.",
  "Bayar sekali, akses selamanya.",
  "Langsung bisa diunduh setelah bayar.",
  "Akses penuh, selamanya.",
  "Dukung karya ini — akses penuh.",
];
const CTA_NOTES_FREE = [
  "Ambil sekarang — akses penuh, selamanya.",
  "Gratis — langsung baca.",
  "Tanpa biaya, tanpa syarat.",
  "Nikmati sekarang juga.",
];
const CTA_NOTES_CALENDAR = [
  "Simpan tanggalnya biar tidak terlewat.",
  "Kami ingatkan menjelang acara.",
];

export function ProductEditForm({ pageId, slug, initialHtml, categories, relatedOptions, initial }: Props) {
  const router = useRouter();

  // --- Page info ---
  const [title, setTitle] = useState(initial.title);
  const [previewType, setPreviewType] = useState<PreviewType>(initial.preview_type);
  // Label of the "Preview Product" button on the checkout page. Free text;
  // legacy keyword rows are translated to their wording on the way in, so the
  // dropdown matches a preset instead of dropping into the custom box.
  const [previewLabel, setPreviewLabel] = useState(() =>
    previewLabelForEdit(initial.preview_label),
  );
  const [previewUrl, setPreviewUrl] = useState(initial.preview_url ?? "");
  const [pdfMeta, setPdfMeta] = useState<FileMeta | null>(
    initial.preview_type === "pdf" && initial.preview_url
      ? { name: fileNameFromUrl(initial.preview_url) }
      : null,
  );
  // Optional dark-mode PDF; when both light & dark exist the preview follows the
  // reader's theme, otherwise whichever one is set is always shown.
  const [previewUrlDark, setPreviewUrlDark] = useState(initial.preview_url_dark ?? "");
  const [pdfMetaDark, setPdfMetaDark] = useState<FileMeta | null>(
    initial.preview_type === "pdf" && initial.preview_url_dark
      ? { name: fileNameFromUrl(initial.preview_url_dark) }
      : null,
  );
  // Preview EPUB (single file — the reader themes light/dark itself). Reuses
  // `previewUrl` for the stored public URL, like the PDF/link sources.
  const [epubMeta, setEpubMeta] = useState<FileMeta | null>(
    initial.preview_type === "epub" && initial.preview_url
      ? { name: fileNameFromUrl(initial.preview_url) }
      : null,
  );
  const [epubUploading, setEpubUploading] = useState(false);
  const [epubError, setEpubError] = useState<string | null>(null);

  // Excerpt preview: how much of the deliverable to WITHHOLD. There is no second
  // file — the number is applied when chapters are served.
  const [cutPercent, setCutPercent] = useState<number>(
    initial.preview_cut_percent ?? DEFAULT_CUT_PERCENT,
  );

  // --- Pricing ---
  const [longDescription, setLongDescription] = useState(initial.long_description ?? "");
  const [isFree, setIsFree] = useState(!!initial.is_free);
  const [featured, setFeatured] = useState(!!initial.featured);

  // Preview buy-now card: optional text overrides + action (checkout | link | calendar).
  const [ctaLabel, setCtaLabel] = useState(initial.cta_label ?? "");
  const [ctaNote, setCtaNote] = useState(initial.cta_note ?? "");

  // Presets + the wording used when left on "Bawaan" — both follow whether the
  // product is free and which action the button performs.
  const [actionType, setActionType] = useState<"checkout" | "link" | "calendar">(
    initial.cta_action === "calendar"
      ? "calendar"
      : initial.purchase_type === "external" && initial.purchase_link
        ? "link"
        : "checkout",
  );

  const defaultCtaLabel =
    actionType === "calendar" ? "Tambahkan ke kalender" : isFree ? "Ambil gratis" : "Beli sekarang";
  const defaultCtaNote = isFree
    ? "Ambil sekarang — akses penuh, selamanya."
    : "Miliki sekarang — akses penuh, selamanya.";
  const labelPresets =
    actionType === "calendar"
      ? CTA_LABELS_CALENDAR
      : isFree
        ? CTA_LABELS_FREE
        : CTA_LABELS_PAID;
  const notePresets =
    actionType === "calendar" ? CTA_NOTES_CALENDAR : isFree ? CTA_NOTES_FREE : CTA_NOTES_PAID;
  const [purchaseLink, setPurchaseLink] = useState(initial.purchase_link ?? "");
  // Calendar-event fields (used when actionType === "calendar").
  const [eventTitle, setEventTitle] = useState(initial.event_title ?? "");
  const [eventStart, setEventStart] = useState(initial.event_start ?? "");
  const [eventEnd, setEventEnd] = useState(initial.event_end ?? "");
  const [eventLocation, setEventLocation] = useState(initial.event_location ?? "");
  const [eventDescription, setEventDescription] = useState(initial.event_description ?? "");
  const [price, setPrice] = useState(initial.price != null ? String(initial.price) : "");
  const [priceDiscount, setPriceDiscount] = useState(
    initial.price_discount != null ? String(initial.price_discount) : "",
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnail_url ?? "");
  // Optional wide version used by the 16:9 listing cards.
  const [thumbWideUrl, setThumbWideUrl] = useState(initial.thumbnail_landscape_url ?? "");
  // Extra checkout images (max 2 → three slides with the main thumbnail).
  const [extraUrls, setExtraUrls] = useState<string[]>(
    (initial.thumbnail_extra_urls ?? []).filter((u) => !!u && !!u.trim()).slice(0, 2),
  );
  const [extraSizes, setExtraSizes] = useState<Record<string, number>>({});
  const [extraUploading, setExtraUploading] = useState(false);
  const [extraError, setExtraError] = useState<string | null>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  const [thumbWideMeta, setThumbWideMeta] = useState<FileMeta | null>(
    initial.thumbnail_landscape_url
      ? { name: fileNameFromUrl(initial.thumbnail_landscape_url) }
      : null,
  );
  const [thumbWideUploading, setThumbWideUploading] = useState(false);
  const [thumbWideError, setThumbWideError] = useState<string | null>(null);
  const [thumbWideDragging, setThumbWideDragging] = useState(false);
  const thumbWideInputRef = useRef<HTMLInputElement>(null);
  const [thumbMeta, setThumbMeta] = useState<FileMeta | null>(
    initial.thumbnail_url ? { name: fileNameFromUrl(initial.thumbnail_url) } : null,
  );
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbDragging, setThumbDragging] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(initial.category_id ?? "");

  // Related products (manually curated) shown at the end of this product's
  // preview. Keep only ids that still exist among the offered options.
  const validRelatedIds = new Set(relatedOptions.map((o) => o.id));
  const [relatedIds, setRelatedIds] = useState<string[]>(
    (initial.related_product_ids ?? []).filter((id) => validRelatedIds.has(id)),
  );
  const [relatedSearch, setRelatedSearch] = useState("");
  // Bundle: buying this product also hands over everything selected here.
  const [bundleIds, setBundleIds] = useState<string[]>(
    (initial.bundle_product_ids ?? []).filter((id) => validRelatedIds.has(id)),
  );
  const [bundleNote, setBundleNote] = useState(initial.bundle_note ?? "");
  const [bundleSearch, setBundleSearch] = useState("");

  // Series continuation: the part a reader should go to after finishing this one.
  const [nextProductId, setNextProductId] = useState<string>(
    initial.next_product_id && validRelatedIds.has(initial.next_product_id) ? initial.next_product_id : "",
  );
  const [seriesSearch, setSeriesSearch] = useState("");
  const seriesMatches = relatedOptions.filter((o) =>
    o.title.toLowerCase().includes(seriesSearch.trim().toLowerCase()),
  );
  const selectedNext = relatedOptions.find((o) => o.id === nextProductId) ?? null;

  const toggleRelated = useCallback((id: string) => {
    setRelatedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  // Scheduled release ("upcoming"): when on, the product shows only a countdown
  // to non-owners until `availableAt` passes.
  const [scheduleEnabled, setScheduleEnabled] = useState(!!initial.available_at);
  const [availableAt, setAvailableAt] = useState(isoToLocalInput(initial.available_at));

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

  // Optional dark-mode variant of the PDF deliverable (buyer reads it in dark
  // mode instead of a colour-inverted light file).
  const [storyUrlDark, setStoryUrlDark] = useState(initial.story_pdf_url_dark ?? "");
  const [storyMetaDark, setStoryMetaDark] = useState<FileMeta | null>(
    initial.story_pdf_url_dark ? { name: fileNameFromUrl(initial.story_pdf_url_dark) } : null,
  );
  const [storyUploadingDark, setStoryUploadingDark] = useState(false);
  const [storyErrorDark, setStoryErrorDark] = useState<string | null>(null);

  // Optional EPUB deliverable (buyer reads it in the EPUB reader).
  const [storyEpubUrl, setStoryEpubUrl] = useState(initial.story_epub_url ?? "");
  const [storyEpubMeta, setStoryEpubMeta] = useState<FileMeta | null>(
    initial.story_epub_url ? { name: fileNameFromUrl(initial.story_epub_url) } : null,
  );
  const [storyEpubUploading, setStoryEpubUploading] = useState(false);
  const [storyEpubError, setStoryEpubError] = useState<string | null>(null);

  // The buyer receives exactly one file: a ZIP (downloaded), a PDF, or an EPUB
  // (both read in the purchases list). Default to whichever already exists.
  const [deliverableType, setDeliverableType] = useState<DeliverableType>(
    initial.story_epub_url && !initial.zip_url && !initial.story_pdf_url
      ? "epub"
      : initial.story_pdf_url && !initial.zip_url
        ? "pdf"
        : "zip",
  );

  // --- Action bar ---
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Which form tab is showing. All panels stay mounted (hidden when inactive) so
  // inputs + the Monaco editor never lose state; one Save persists everything.
  const [tab, setTab] = useState<TabKey>("detail");

  const thumbInputRef = useRef<HTMLInputElement>(null);

  const pNum = parseFloat(price);
  const dNum = parseFloat(priceDiscount);
  const discountPct =
    !isFree && pNum > 0 && dNum > 0 && dNum < pNum ? Math.round((1 - dNum / pNum) * 100) : null;

  /* ---------------------------- Uploads ---------------------------------- */

  // Uploads only push the file to storage + set local state. Nothing is written
  // to the DB until the user clicks "Simpan perubahan" (handleSaveAll).
  async function handleZipUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipUploading(true);
    setZipError(null);
    try {
      // Pass the current deliverable path so it's deleted once the new one is stored.
      const res = await uploadZipClient(pageId, file, zipUrl || null);
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
      // Pass the current deliverable path so it's deleted once the new one is stored.
      const res = await uploadStoryPdfClient(pageId, file, storyUrl || null);
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

  async function handleStoryUploadDark(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoryUploadingDark(true);
    setStoryErrorDark(null);
    try {
      // Pass the current dark PDF path so it's deleted once the new one is stored.
      const res = await uploadStoryPdfClient(pageId, file, storyUrlDark || null);
      if ("error" in res) {
        setStoryErrorDark(res.error);
        return;
      }
      setStoryUrlDark(res.url);
      setStoryMetaDark({ name: file.name, size: file.size });
    } catch (err) {
      setStoryErrorDark(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setStoryUploadingDark(false);
      e.target.value = "";
    }
  }

  function removeStoryDark() {
    setStoryUrlDark("");
    setStoryMetaDark(null);
    setStoryErrorDark(null);
  }

  async function handlePreviewEpubUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEpubUploading(true);
    setEpubError(null);
    try {
      const res = await uploadPreviewEpubClient(pageId, file, previewUrl || null);
      if ("error" in res) {
        setEpubError(res.error);
        return;
      }
      setPreviewUrl(res.url);
      setEpubMeta({ name: file.name, size: file.size });
      setMessage({ type: "ok", text: "EPUB terupload. Klik Simpan perubahan untuk menerapkan." });
    } catch (err) {
      setEpubError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setEpubUploading(false);
      e.target.value = "";
    }
  }

  function removePreviewEpub() {
    setPreviewUrl("");
    setEpubMeta(null);
    setEpubError(null);
  }

  async function handleStoryEpubUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoryEpubUploading(true);
    setStoryEpubError(null);
    try {
      const res = await uploadStoryEpubClient(pageId, file, storyEpubUrl || null);
      if ("error" in res) {
        setStoryEpubError(res.error);
        return;
      }
      setStoryEpubUrl(res.url);
      setStoryEpubMeta({ name: file.name, size: file.size });
    } catch (err) {
      setStoryEpubError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setStoryEpubUploading(false);
      e.target.value = "";
    }
  }

  function removeStoryEpub() {
    setStoryEpubUrl("");
    setStoryEpubMeta(null);
    setStoryEpubError(null);
  }

  const uploadThumbFile = useCallback(
    async (file: File) => {
      if (file.type && !file.type.startsWith("image/")) {
        setThumbError("File harus berupa gambar.");
        return;
      }
      setThumbUploading(true);
      setThumbError(null);
      try {
        // Pass the current thumbnail so it's deleted once the new one is stored.
        const res = await uploadThumbnailClient(pageId, file, thumbnailUrl || null);
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


  // Sizes for files that were already stored: the File object only exists for a
  // fresh pick, so a reopened product would otherwise show a name with no size.
  useEffect(() => {
    const refs = [
      initial.preview_url,
      initial.preview_url_dark,
      initial.thumbnail_url,
      initial.thumbnail_landscape_url,
      initial.zip_url,
      initial.story_pdf_url,
      initial.story_pdf_url_dark,
      initial.story_epub_url,
      ...(initial.thumbnail_extra_urls ?? []),
    ].filter((r): r is string => !!r && !!r.trim());
    if (refs.length === 0) return;

    let cancelled = false;
    getStoredFileSizes(refs).then((sizes) => {
      if (cancelled) return;
      const put =
        (ref: string | null | undefined) =>
        (prev: FileMeta | null): FileMeta | null => {
          const size = ref ? sizes[ref] : undefined;
          if (!prev || size === undefined || prev.size !== undefined) return prev;
          return { ...prev, size };
        };
      setPdfMeta(put(initial.preview_url));
      setPdfMetaDark(put(initial.preview_url_dark));
      setEpubMeta(put(initial.preview_url));
      setThumbMeta(put(initial.thumbnail_url));
      setThumbWideMeta(put(initial.thumbnail_landscape_url));
      setZipMeta(put(initial.zip_url));
      setStoryMeta(put(initial.story_pdf_url));
      setStoryMetaDark(put(initial.story_pdf_url_dark));
      setStoryEpubMeta(put(initial.story_epub_url));
      setExtraSizes((prev) => ({ ...sizes, ...prev }));
    });
    return () => {
      cancelled = true;
    };
    // Runs once for the product that was loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadThumbWideFile = useCallback(
    async (file: File) => {
      if (file.type && !file.type.startsWith("image/")) {
        setThumbWideError("File harus berupa gambar.");
        return;
      }
      setThumbWideUploading(true);
      setThumbWideError(null);
      try {
        const res = await uploadThumbnailClient(pageId, file, thumbWideUrl || null);
        if ("error" in res) setThumbWideError(res.error);
        else {
          setThumbWideUrl(res.url);
          setThumbWideMeta({ name: file.name, size: file.size });
        }
      } finally {
        setThumbWideUploading(false);
      }
    },
    [pageId, thumbWideUrl],
  );

  const uploadExtraFile = useCallback(
    async (file: File) => {
      if (file.type && !file.type.startsWith("image/")) {
        setExtraError("File harus berupa gambar.");
        return;
      }
      setExtraUploading(true);
      setExtraError(null);
      try {
        // No previous URL to replace — each extra is its own slot.
        const res = await uploadThumbnailClient(pageId, file, null);
        if ("error" in res) setExtraError(res.error);
        else {
          setExtraUrls((prev) => [...prev, res.url].slice(0, 2));
          setExtraSizes((prev) => ({ ...prev, [res.url]: file.size }));
        }
      } finally {
        setExtraUploading(false);
      }
    },
    [pageId],
  );

  function removeExtra(url: string) {
    setExtraUrls((prev) => prev.filter((u) => u !== url));
    setExtraError(null);
  }

  function removeThumbWide() {
    setThumbWideUrl("");
    setThumbWideMeta(null);
    setThumbWideError(null);
  }

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
    if (previewType === "pdf" && !previewUrl.trim() && !previewUrlDark.trim()) {
      setMessage({ type: "err", text: "Upload minimal satu PDF (terang atau gelap)." });
      return;
    }
    if (previewType === "excerpt" && !storyEpubUrl.trim()) {
      setMessage({ type: "err", text: "Upload EPUB pembeli dulu di tab Pengiriman." });
      return;
    }
    if (previewType === "epub" && !previewUrl.trim()) {
      setMessage({ type: "err", text: "Upload file EPUB dulu." });
      return;
    }
    if (previewType === "link" && !previewUrl.trim()) {
      setMessage({ type: "err", text: "Isi URL link dulu." });
      return;
    }
    if (
      previewType === "deliverable" &&
      !((deliverableType === "epub" && storyEpubUrl.trim()) || (deliverableType === "pdf" && storyUrl.trim()))
    ) {
      setMessage({
        type: "err",
        text: "Untuk preview 'sama dgn deliverable', set file PDF/EPUB pembeli dulu di tab Pengiriman.",
      });
      return;
    }
    if (actionType === "link" && !purchaseLink.trim()) {
      setMessage({ type: "err", text: "Isi URL tujuan tombol beli dulu." });
      return;
    }
    if (actionType === "calendar" && !eventStart.trim()) {
      setMessage({ type: "err", text: "Isi tanggal & waktu mulai acara dulu." });
      return;
    }
    if (scheduleEnabled && !availableAt.trim()) {
      setMessage({ type: "err", text: "Isi tanggal & waktu rilis dulu." });
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
          // "excerpt" stores no preview_url either — it reads story_epub_url.
          preview_url:
            previewType === "html" || previewType === "deliverable" || previewType === "excerpt"
              ? null
              : previewUrl.trim() || null,
          preview_url_dark: previewType === "pdf" ? previewUrlDark.trim() || null : null,
          preview_cut_percent: clampCutPercent(cutPercent),
        },
        slug,
      );
      await updateLandingPagePricing(pageId, {
        price: isFree ? null : price ? parseFloat(price) : null,
        price_discount: isFree || !priceDiscount ? null : parseFloat(priceDiscount),
        is_free: isFree,
        purchase_link: actionType === "link" ? purchaseLink.trim() || null : null,
        purchase_type: actionType === "link" && purchaseLink.trim() ? "external" : "internal",
        cta_label: ctaLabel.trim() || null,
        cta_note: ctaNote.trim() || null,
        cta_action: actionType,
        event_title: actionType === "calendar" ? eventTitle.trim() || null : null,
        event_start: actionType === "calendar" ? eventStart.trim() || null : null,
        event_end: actionType === "calendar" ? eventEnd.trim() || null : null,
        event_location: actionType === "calendar" ? eventLocation.trim() || null : null,
        event_description: actionType === "calendar" ? eventDescription.trim() || null : null,
        featured,
        thumbnail_url: thumbnailUrl.trim() || null,
        thumbnail_landscape_url: thumbWideUrl.trim() || null,
        thumbnail_extra_urls: extraUrls.length ? extraUrls : null,
        zip_url: deliverableType === "zip" ? zipUrl.trim() || null : null,
        story_pdf_url: deliverableType === "pdf" ? storyUrl.trim() || null : null,
        story_pdf_url_dark: deliverableType === "pdf" ? storyUrlDark.trim() || null : null,
        story_epub_url: deliverableType === "epub" ? storyEpubUrl.trim() || null : null,
        category_id: categoryId.trim() || null,
        long_description: longDescription.trim() || null,
        preview_label: previewLabel.trim() || null,
        related_product_ids: relatedIds,
        next_product_id: nextProductId || null,
        bundle_product_ids: bundleIds.length ? bundleIds : null,
        bundle_note: bundleNote.trim() || null,
        available_at:
          scheduleEnabled && availableAt.trim()
            ? new Date(availableAt).toISOString()
            : null,
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
    <div className="space-y-5 pb-4">
      {/* Tabs */}
      <div className="sticky top-0 z-20 -mx-3 flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--card)]/95 px-3 py-1.5 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-1 sm:shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========================= Tab: Detail ========================= */}
      <section className={tab === "detail" ? PANEL_CLASS : "hidden"}>
        <div>
          <h2 className="text-base font-semibold text-foreground">Detail produk</h2>
          <p className="text-sm text-[var(--muted)]">Judul, kategori, thumbnail, dan deskripsi produk.</p>
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

        {/* Landscape thumbnail — used by the 16:9 cards in listings. */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-foreground">
            Thumbnail landscape{" "}
            <span className="text-[var(--muted)]">(opsional — untuk kartu di daftar produk)</span>
          </span>
          <p className="text-xs text-[var(--muted)]">
            Kartu di homepage &amp; kategori berbentuk lebar (16:9). Kalau thumbnail utamamu
            portrait, upload versi lebar di sini biar tidak terpotong. Dikosongkan = pakai
            thumbnail utama.
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
                  {thumbWideUploading ? "Mengupload…" : "Ganti gambar"}
                </button>
              </div>
              <button
                type="button"
                onClick={removeThumbWide}
                title="Hapus thumbnail landscape"
                aria-label="Hapus thumbnail landscape"
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
                {thumbWideUploading ? "Mengupload…" : "Pilih gambar landscape"}
              </span>
              <span className="text-xs text-[var(--muted)]">Rasio 16:9 paling pas</span>
            </button>
          )}
          {thumbWideError && <p className="text-xs text-red-500">{thumbWideError}</p>}
        </div>

        {/* Extra images — become swipeable slides on the checkout page. */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-foreground">
            Gambar tambahan{" "}
            <span className="text-[var(--muted)]">(opsional — maks. 2, tampil sebagai slide)</span>
          </span>
          <p className="text-xs text-[var(--muted)]">
            Di halaman checkout, gambar ini bisa digeser bersama thumbnail utama (maks. 3 slide).
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
                    title="Hapus gambar"
                    aria-label="Hapus gambar"
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
                {extraUploading ? "Mengupload…" : "Tambah gambar"}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {2 - extraUrls.length} slot tersisa
              </span>
            </button>
          )}
          {extraError && <p className="text-xs text-red-500">{extraError}</p>}
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
                {formatBytes(thumbMeta?.size) && (
                  <p className="text-xs text-[var(--muted)]">{formatBytes(thumbMeta?.size)}</p>
                )}
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
      </section>

      {/* ========================= Tab: Preview ========================= */}
      <section className={tab === "preview" ? PANEL_CLASS : "hidden"}>
        <div>
          <h2 className="text-base font-semibold text-foreground">Preview / demo</h2>
          <p className="text-sm text-[var(--muted)]">Sumber preview yang dilihat pengunjung sebelum membeli.</p>
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

        {/* PDF upload — light + optional dark variant. */}
        {previewType === "pdf" && (
          <div className="space-y-4">
            <p className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
              Upload versi <strong className="text-foreground">terang</strong> &amp;{" "}
              <strong className="text-foreground">gelap</strong> agar preview mengikuti tema pembaca.
              Kalau hanya satu yang diupload, versi itu yang selalu tampil.
            </p>
            <PdfPreviewSlot
              label="PDF versi terang (light)"
              pageId={pageId}
              url={previewUrl}
              meta={pdfMeta}
              onUploaded={(url, meta) => {
                setPreviewUrl(url);
                setPdfMeta(meta);
                setMessage({ type: "ok", text: "PDF terupload. Klik Simpan perubahan untuk menerapkan." });
              }}
              onClear={() => {
                setPreviewUrl("");
                setPdfMeta(null);
              }}
              onError={(text) => setMessage({ type: "err", text })}
            />
            <PdfPreviewSlot
              label="PDF versi gelap (dark)"
              hint="Opsional — tampil saat pembaca memakai mode gelap."
              pageId={pageId}
              url={previewUrlDark}
              meta={pdfMetaDark}
              onUploaded={(url, meta) => {
                setPreviewUrlDark(url);
                setPdfMetaDark(meta);
                setMessage({ type: "ok", text: "PDF (gelap) terupload. Klik Simpan perubahan untuk menerapkan." });
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
              Cukup satu file EPUB — pembaca bisa ganti <strong className="text-foreground">terang</strong> /{" "}
              <strong className="text-foreground">gelap</strong> langsung di reader (tema diterapkan otomatis).
            </p>
            <FileUploadCard
              label="File EPUB untuk preview"
              accept=".epub,application/epub+zip"
              badge="EPUB"
              badgeClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              url={previewUrl}
              meta={epubMeta}
              uploading={epubUploading}
              error={epubError}
              statusText="EPUB terpasang"
              onUpload={handlePreviewEpubUpload}
              onRemove={removePreviewEpub}
            />
          </div>
        )}

        {/* Preview = part of the deliverable. One file, truncated when served. */}
        {previewType === "excerpt" && (
          <div className="space-y-3">
            {!storyEpubUrl.trim() ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Belum ada file <strong>EPUB</strong> pembeli. Buka tab <strong>Pengiriman</strong>, pilih tipe
                file EPUB lalu upload — preview mengambil sebagian dari file itu.
              </p>
            ) : (
              <>
                <p className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
                  Preview memakai <strong className="text-foreground">file yang sama</strong> dengan yang
                  diterima pembeli — tidak ada file preview terpisah, jadi cukup edit satu buku. Bab yang
                  belum kebagian tidak dikirim ke browser, bukan sekadar disembunyikan.
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="cut-percent" className="block text-sm font-medium text-foreground">
                    Bagian yang disembunyikan
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="cut-percent"
                      type="range"
                      min={5}
                      max={95}
                      step={5}
                      value={cutPercent}
                      onChange={(e) => setCutPercent(clampCutPercent(e.target.value))}
                      className="h-2 w-56 max-w-full accent-[var(--primary)]"
                    />
                    <span className="shrink-0 text-sm text-foreground">
                      <strong>{cutPercent}%</strong>{" "}
                      <span className="text-[var(--muted)]">
                        disembunyikan · pembaca dapat {100 - cutPercent}%
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    Dihitung dari panjang teks, lalu dibulatkan ke batas bab terdekat — preview tidak
                    pernah berhenti di tengah kalimat. Bab terakhir selalu ditahan.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Preview = deliverable — no separate upload; reuses the buyer's file. */}
        {previewType === "deliverable" && (
          <div className="space-y-2">
            {(deliverableType === "epub" && storyEpubUrl.trim()) ||
            (deliverableType === "pdf" && storyUrl.trim()) ? (
              <p className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
                Preview menampilkan file{" "}
                <strong className="text-foreground">{deliverableType === "epub" ? "EPUB" : "PDF"}</strong> pembeli
                yang Anda atur di tab <strong className="text-foreground">Pengiriman</strong>. Seluruh isi bisa
                dibaca gratis di preview — cocok untuk produk gratis atau sampel penuh.
              </p>
            ) : (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Belum ada file <strong>PDF</strong>/<strong>EPUB</strong> pembeli. Buka tab{" "}
                <strong>Pengiriman</strong>, pilih tipe file PDF atau EPUB lalu upload — baru opsi ini bisa dipakai.
              </p>
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

        {/* Label of the "Preview" button shown on the checkout page. */}
        <div className="sm:max-w-xs">
          <PresetTextField
            id="preview-label"
            label="Teks tombol preview"
            value={previewLabel}
            onChange={setPreviewLabel}
            options={PREVIEW_LABEL_PRESETS}
            placeholder={DEFAULT_PREVIEW_LABEL}
            maxLength={PREVIEW_LABEL_MAX}
            hint="Teks tombol yang membuka halaman preview dari halaman checkout."
          />
        </div>

        {/* Monaco editor — only for the HTML preview source. Keeps its own save. */}
        {previewType === "html" && (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 sm:p-4">
            <Editor id={pageId} initialHtml={initialHtml} />
          </div>
        )}
      </section>

      {/* ========================= Tab: Harga ========================= */}
      <section className={tab === "harga" ? PANEL_CLASS : "hidden"}>
        <div>
          <h2 className="text-base font-semibold text-foreground">Harga &amp; penjualan</h2>
          <p className="text-sm text-[var(--muted)]">Harga, status, jadwal rilis, dan tombol beli.</p>
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

        {/* Scheduled release ("upcoming"): before the time, visitors see only a
            countdown and can't read/buy. */}
        <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
          <ToggleCard
            checked={scheduleEnabled}
            onChange={setScheduleEnabled}
            title="Jadwalkan rilis (upcoming)"
            description="Tampilkan hitung mundur dulu — pengunjung baru bisa baca & beli setelah waktunya tiba."
          />
          {scheduleEnabled && (
            <div className="space-y-1.5">
              <label htmlFor="available-at" className="block text-sm font-medium text-foreground">
                Tanggal &amp; waktu rilis <span className="text-red-500">*</span>
              </label>
              <input
                id="available-at"
                type="datetime-local"
                value={availableAt}
                onChange={(e) => setAvailableAt(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 sm:max-w-xs"
              />
              <p className="text-xs text-[var(--muted)]">
                Memakai zona waktu perangkat Anda. Sebelum waktu ini, halaman preview &amp; checkout
                hanya menampilkan hitung mundur (Anda sendiri tetap bisa membukanya untuk cek).
                Setelah lewat, produk otomatis terbuka.
              </p>
            </div>
          )}
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

        {/* Preview buy-now card: text overrides + action */}
        <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Tombol beli</h3>
            <p className="text-xs text-[var(--muted)]">
              Atur teks &amp; tujuan tombol beli — berlaku di kartu &ldquo;beli sekarang&rdquo;
              pada halaman preview <strong className="text-foreground">dan</strong> di halaman
              checkout. Kosongkan teks untuk memakai bawaan.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cta-action" className="block text-sm font-medium text-foreground">
              Aksi tombol
            </label>
            <select
              id="cta-action"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as "checkout" | "link" | "calendar")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 sm:max-w-xs"
            >
              <option value="checkout">Checkout di situs ini (default)</option>
              <option value="link">Link eksternal</option>
              <option value="calendar">Tambahkan ke kalender</option>
            </select>
            <p className="text-xs text-[var(--muted)]">
              {actionType === "link"
                ? "Tombol mengarah ke URL yang Anda isi (membuka tab baru), melewati checkout bawaan."
                : actionType === "calendar"
                  ? "Tombol menambahkan acara ke kalender pengunjung (file .ics — jalan di iOS, Android & desktop)."
                  : "Tombol mengarah ke halaman checkout produk ini."}
            </p>
          </div>

          {actionType === "link" && (
            <div className="space-y-1.5">
              <label htmlFor="cta-link" className="block text-sm font-medium text-foreground">
                URL tujuan
              </label>
              <input
                id="cta-link"
                type="url"
                value={purchaseLink}
                onChange={(e) => setPurchaseLink(e.target.value)}
                placeholder="https://contoh.com/beli"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />
            </div>
          )}

          {actionType === "calendar" && (
            <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <p className="text-xs text-[var(--muted)]">
                Detail acara yang ditambahkan ke kalender pengunjung. Waktu memakai zona waktu
                lokal perangkat pengunjung.
              </p>
              <div className="space-y-1.5">
                <label htmlFor="event-title" className="block text-sm font-medium text-foreground">
                  Judul acara
                </label>
                <input
                  id="event-title"
                  type="text"
                  value={eventTitle}
                  maxLength={200}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder={title || "Judul acara"}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                />
                <p className="text-xs text-[var(--muted)]">Kosongkan untuk memakai judul produk.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="event-start" className="block text-sm font-medium text-foreground">
                    Mulai <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="event-start"
                    type="datetime-local"
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="event-end" className="block text-sm font-medium text-foreground">
                    Selesai
                  </label>
                  <input
                    id="event-end"
                    type="datetime-local"
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                  />
                  <p className="text-xs text-[var(--muted)]">Kosong = 1 jam setelah mulai.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="event-location" className="block text-sm font-medium text-foreground">
                  Lokasi
                </label>
                <input
                  id="event-location"
                  type="text"
                  value={eventLocation}
                  maxLength={300}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Alamat, atau link Zoom/Google Meet"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="event-desc" className="block text-sm font-medium text-foreground">
                  Deskripsi
                </label>
                <textarea
                  id="event-desc"
                  value={eventDescription}
                  maxLength={1000}
                  rows={3}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Catatan acara yang tampil di kalender…"
                  className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <PresetTextField
              id="cta-label"
              label="Teks tombol"
              value={ctaLabel}
              onChange={setCtaLabel}
              options={labelPresets}
              placeholder={defaultCtaLabel}
              maxLength={40}
            />
            <PresetTextField
              id="cta-note"
              label="Teks keterangan"
              value={ctaNote}
              onChange={setCtaNote}
              options={notePresets}
              placeholder={defaultCtaNote}
              maxLength={80}
            />
          </div>

          <p className="text-xs text-[var(--muted)]">
            Tombol beli tampil di akhir halaman preview, setelah pembaca selesai —
            tidak lagi mengapung di atas bacaan.
          </p>

        </div>

      </section>

      {/* ========================= Tab: Pengiriman ========================= */}
      <section className={tab === "pengiriman" ? PANEL_CLASS : "hidden"}>
        <div>
          <h2 className="text-base font-semibold text-foreground">Pengiriman</h2>
          <p className="text-sm text-[var(--muted)]">File yang diterima pembeli setelah membeli.</p>
        </div>

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
              <option value="epub">EPUB — dibaca pembeli di daftar pembelian</option>
            </select>
            <p className="text-xs text-[var(--muted)]">
              {deliverableType === "zip"
                ? "Pembeli mengunduh file ZIP setelah pembayaran berhasil."
                : deliverableType === "epub"
                  ? "Pembeli membaca file EPUB langsung dari daftar pembelian (bisa ganti tema)."
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
          ) : deliverableType === "epub" ? (
            <FileUploadCard
              label="File EPUB (dibaca pembeli setelah pembayaran)"
              accept=".epub,application/epub+zip"
              badge="EPUB"
              badgeClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              url={storyEpubUrl}
              meta={storyEpubMeta}
              uploading={storyEpubUploading}
              error={storyEpubError}
              statusText="EPUB terpasang"
              onUpload={handleStoryEpubUpload}
              onRemove={removeStoryEpub}
            />
          ) : (
            <div className="space-y-3">
              <p className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
                Bisa upload dua versi: <strong className="text-foreground">terang</strong> &amp;{" "}
                <strong className="text-foreground">gelap</strong>. Pembaca yang memakai mode gelap
                akan melihat versi gelap. Kalau versi gelap kosong, versi terang dipakai untuk semua.
              </p>
              <FileUploadCard
                label="File PDF versi terang (light) — wajib"
                accept=".pdf,application/pdf"
                badge="PDF"
                badgeClass="bg-red-500/10 text-red-600 dark:text-red-400"
                url={storyUrl}
                meta={storyMeta}
                uploading={storyUploading}
                error={storyError}
                statusText="PDF (terang) terpasang"
                onUpload={handleStoryUpload}
                onRemove={removeStory}
              />
              <FileUploadCard
                label="File PDF versi gelap (dark) — opsional"
                accept=".pdf,application/pdf"
                badge="PDF"
                badgeClass="bg-slate-500/10 text-slate-600 dark:text-slate-300"
                url={storyUrlDark}
                meta={storyMetaDark}
                uploading={storyUploadingDark}
                error={storyErrorDark}
                statusText="PDF (gelap) terpasang"
                onUpload={handleStoryUploadDark}
                onRemove={removeStoryDark}
              />
            </div>
          )}
        </div>


        {/* Bundle — buying this product grants everything listed here. */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Bundle</h2>
            <p className="text-sm text-[var(--muted)]">
              Jadikan produk ini sebuah paket. Saat pembeli membelinya, semua produk yang
              dipilih di bawah otomatis masuk ke akun mereka — bisa langsung dibuka &amp;
              diunduh dari halaman &ldquo;Pembelian saya&rdquo;. Kosongkan kalau ini bukan bundle.
            </p>
          </div>

          {relatedOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
              Belum ada produk lain untuk dimasukkan ke bundle.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  value={bundleSearch}
                  onChange={(e) => setBundleSearch(e.target.value)}
                  placeholder="Cari produk…"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                />
                <span className="shrink-0 text-xs text-[var(--muted)]">{bundleIds.length} dipilih</span>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
                {relatedOptions
                  .filter((o) => o.title.toLowerCase().includes(bundleSearch.trim().toLowerCase()))
                  .map((o) => {
                    const checked = bundleIds.includes(o.id);
                    return (
                      <label
                        key={o.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--background)]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setBundleIds((prev) =>
                              e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id),
                            )
                          }
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="truncate">{o.title}</span>
                      </label>
                    );
                  })}
              </div>

              <PresetTextField
                id="bundle-note"
                label="Teks bundle"
                value={bundleNote}
                onChange={setBundleNote}
                options={BUNDLE_NOTES}
                placeholder="Tanpa teks tambahan"
                maxLength={120}
                hint="Muncul di halaman checkout, di atas daftar isi bundle."
              />
            </>
          )}
        </div>
      </section>

      {/* ========================= Tab: Terkait ========================= */}
      <section className={tab === "terkait" ? PANEL_CLASS : "hidden"}>
        <div>
          <h2 className="text-base font-semibold text-foreground">Produk terkait</h2>
          <p className="text-sm text-[var(--muted)]">
            Muncul di akhir preview (setelah halaman terakhir). Pilih dari produk Anda sendiri.
          </p>
        </div>

        {/* Related products picker */}
        <div className="space-y-2">
          {relatedOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
              Belum ada produk lain untuk dijadikan produk terkait.
            </p>
          ) : (
            <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={relatedSearch}
                  onChange={(e) => setRelatedSearch(e.target.value)}
                  placeholder="Cari produk…"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                />
                <span className="shrink-0 rounded-md bg-[var(--background)] px-2 py-1 text-xs text-[var(--muted)]">
                  {relatedIds.length} dipilih
                </span>
              </div>

              <div className="max-h-56 space-y-0.5 overflow-y-auto">
                {relatedOptions
                  .filter((o) => o.title.toLowerCase().includes(relatedSearch.trim().toLowerCase()))
                  .map((o) => {
                    const checked = relatedIds.includes(o.id);
                    return (
                      <label
                        key={o.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                          checked ? "bg-[var(--primary)]/5" : "hover:bg-[var(--background)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRelated(o.id)}
                          className="h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--primary)]"
                        />
                        <span className="min-w-0 flex-1 truncate text-foreground">{o.title}</span>
                        <span className="shrink-0 font-mono text-xs text-[var(--muted)]">{o.slug}</span>
                      </label>
                    );
                  })}
                {relatedOptions.filter((o) =>
                  o.title.toLowerCase().includes(relatedSearch.trim().toLowerCase()),
                ).length === 0 && (
                  <p className="px-2.5 py-3 text-center text-xs text-[var(--muted)]">
                    Tidak ada produk yang cocok.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Series continuation */}
        <div className="space-y-2 border-t border-[var(--border)] pt-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Lanjutan seri</h2>
            <p className="text-sm text-[var(--muted)]">
              Kalau produk ini bagian dari seri, pilih part berikutnya. Tombol &ldquo;Baca
              kelanjutannya&rdquo; akan muncul di akhir preview supaya pembaca tidak berhenti di sini.
            </p>
          </div>
          {relatedOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
              Belum ada produk lain untuk dijadikan lanjutan seri.
            </p>
          ) : (
            <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
              <input
                type="text"
                value={seriesSearch}
                onChange={(e) => setSeriesSearch(e.target.value)}
                placeholder="Cari produk…"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />

              {/* The pick stays visible even when the search hides its row —
                  otherwise typing looks like it cleared the selection. */}
              {selectedNext && (
                <div className="flex items-center gap-2 rounded-lg bg-[var(--primary)]/5 px-2.5 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {selectedNext.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNextProductId("")}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
                  >
                    Hapus
                  </button>
                </div>
              )}

              <div className="max-h-56 space-y-0.5 overflow-y-auto">
                {seriesMatches.map((o) => {
                  const checked = nextProductId === o.id;
                  return (
                    <label
                      key={o.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        checked ? "bg-[var(--primary)]/5" : "hover:bg-[var(--background)]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="next-product"
                        checked={checked}
                        // Picking the current one again clears it, so the only
                        // way out isn't hunting for the "Hapus" button.
                        onClick={() => setNextProductId(checked ? "" : o.id)}
                        onChange={() => {}}
                        className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-foreground">{o.title}</span>
                      <span className="shrink-0 font-mono text-xs text-[var(--muted)]">
                        {o.slug}
                      </span>
                    </label>
                  );
                })}
                {seriesMatches.length === 0 && (
                  <p className="px-2.5 py-3 text-center text-xs text-[var(--muted)]">
                    Tidak ada produk yang cocok.
                  </p>
                )}
              </div>
            </div>
          )}
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
