"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { getStoredFileSizes } from "@/lib/actions/file-sizes";
import {
  DEFAULT_CUT_PERCENT,
  MAX_CUT_PERCENT,
  MIN_CUT_PERCENT,
  clampCutPercent,
} from "@/lib/epub-cut";
import { purgePreviewCache } from "@/lib/actions/preview-cache";
import { useRouter } from "next/navigation";
import {
  updateLandingPageSettings,
  updateLandingPagePricing,
  setLandingPagePublished,
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
import { BUNDLE_NOTES } from "./bundle-notes";
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
import { ToggleCard } from "@/components/toggle-card";
import { ScheduleTab } from "./tabs/schedule-tab";
import { RelatedTab } from "./tabs/related-tab";
import { DeliveryTab } from "./tabs/delivery-tab";
import { DetailTab } from "./tabs/detail-tab";
import { PriceTab } from "./tabs/price-tab";
import { ThumbnailTab } from "./tabs/thumbnail-tab";
import { PREVIEW_OPTIONS } from "./preview-options";
import { PdfPreviewSlot } from "./pdf-preview-slot";
import { CutPercentField } from "./cut-percent-field";
import { PreviewTab } from "./tabs/preview-tab";
import type { DeliverableType } from "./deliverable-type";
import { ExternalIcon, FileTextIcon, ImageIcon, TrashIcon } from "./icons";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */





/** Quick picks for the excerpt cut, so the common values are one tap away. */


type TabKey =
  | "detail"
  | "thumbnail"
  | "preview"
  | "harga"
  | "jadwal"
  | "pengiriman"
  | "terkait";
/**
 * Tab order, with the message key rather than the translated label.
 *
 * This list is module scope, evaluated once when the file is imported — so a
 * label resolved here would freeze whichever language happened to load first
 * and never change again. The lookup belongs where `t` is bound to the request.
 */
const TABS: { key: TabKey; labelKey: MessageKey }[] = [
  { key: "detail", labelKey: "product.tabDetail" },
  { key: "thumbnail", labelKey: "product.tabThumbnail" },
  { key: "preview", labelKey: "product.tabPreview" },
  { key: "harga", labelKey: "product.tabPrice" },
  { key: "jadwal", labelKey: "product.tabSchedule" },
  { key: "pengiriman", labelKey: "product.tabDelivery" },
  { key: "terkait", labelKey: "product.tabRelated" },
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
  /** Drives the draft/publish split in the action bar. */
  published: boolean;
  initial: {
    title: string;
    preview_type: PreviewType;
    preview_url: string | null;
    preview_url_dark?: string | null;
    preview_cut_percent?: number | null;
    price?: number | null;
    price_discount?: number | null;
    is_free?: boolean;
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

/**
 * Single stateful form for the product edit page: page info (title + preview
 * source) and pricing/purchase, saved together from one sticky action bar. The
 * Monaco HTML editor keeps its own save (heavy, separate surface) and only shows
 * when the preview source is "HTML editor".
 */

/* Ready-made CTA wording, so button copy stays consistent across products
   instead of being retyped each time. "Lainnya…" still allows anything. */

const CTA_LABELS_PAID: MessageKey[] = [
  "checkout.buyNow",
  "product.ctaLabelOwn",
  "product.ctaLabelGet",
  "product.ctaLabelRead",
  "product.ctaLabelDownload",
  "product.ctaLabelCheckout",
];
const CTA_LABELS_FREE: MessageKey[] = [
  "checkout.getFree",
  "product.ctaLabelReadFree",
  "product.ctaLabelDownloadFree",
  "product.ctaLabelStartReading",
  "product.ctaLabelGet",
];
const CTA_LABELS_CALENDAR: MessageKey[] = [
  "product.ctaActionCalendar",
  "product.ctaLabelSaveDate",
  "product.ctaLabelRemindMe",
];
const CTA_NOTES_PAID: MessageKey[] = [
  "product.ctaNotePaidDefault",
  "product.ctaNotePayOnce",
  "product.ctaNoteInstantDownload",
  "product.ctaNoteFullAccess",
  "product.ctaNoteSupport",
];
const CTA_NOTES_FREE: MessageKey[] = [
  "product.ctaNoteFreeDefault",
  "product.ctaNoteFreeRead",
  "product.ctaNoteNoStrings",
  "product.ctaNoteEnjoy",
];
const CTA_NOTES_CALENDAR: MessageKey[] = [
  "product.ctaNoteSaveDate",
  "product.ctaNoteRemind",
];

export function ProductEditForm({
  pageId,
  slug,
  initialHtml,
  categories,
  relatedOptions,
  published,
  initial,
}: Props) {
  const t = useT();
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

  const [purging, setPurging] = useState(false);
  const [purged, setPurged] = useState<string | null>(null);

  const runPurge = useCallback(async () => {
    setPurging(true);
    setPurged(null);
    const res = await purgePreviewCache(pageId);
    setPurged(res.ok ? t("product.cachePurged") : res.error);
    setPurging(false);
  }, [pageId]);

  // --- Pricing ---
  const [longDescription, setLongDescription] = useState(initial.long_description ?? "");
  const [isFree, setIsFree] = useState(!!initial.is_free);

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
    actionType === "calendar"
      ? t("product.ctaActionCalendar")
      : isFree
        ? t("checkout.getFree")
        : t("checkout.buyNow");
  const defaultCtaNote = isFree
    ? t("product.ctaNoteFreeDefault")
    : t("product.ctaNotePaidDefault");
  // Resolved here rather than in the arrays above: the presets are module
  // scope, so a translated string there would be the first request's language
  // for every request after it. PriceTab still receives plain strings.
  const labelPresets = (
    actionType === "calendar" ? CTA_LABELS_CALENDAR : isFree ? CTA_LABELS_FREE : CTA_LABELS_PAID
  ).map((k) => t(k));
  const notePresets = (
    actionType === "calendar" ? CTA_NOTES_CALENDAR : isFree ? CTA_NOTES_FREE : CTA_NOTES_PAID
  ).map((k) => t(k));
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

  /** Is the currently selected deliverable slot still empty? */
  const deliverableEmpty =
    deliverableType === "zip"
      ? !zipUrl.trim()
      : deliverableType === "pdf"
        ? !storyUrl.trim()
        : !storyEpubUrl.trim();

  /**
   * Choosing a preview source that reads the buyer's own file also needs that
   * file to be of a usable kind: "excerpt" can only cut an EPUB, and a ZIP can't
   * be rendered as a preview at all. Switch the deliverable type only when the
   * current slot is EMPTY — an already-uploaded ZIP/PDF is left alone and the
   * Preview tab shows an explicit warning instead of quietly dropping a file.
   */
  const pickPreviewType = useCallback(
    (next: PreviewType) => {
      setPreviewType(next);
      if (!deliverableEmpty) return;
      if (next === "excerpt" && deliverableType !== "epub") setDeliverableType("epub");
      if (next === "deliverable" && deliverableType === "zip") setDeliverableType("epub");
    },
    [deliverableEmpty, deliverableType],
  );

  // --- Action bar ---
  // `saving` also records WHICH button is busy, so a two-button draft/publish bar
  // spins only the one that was pressed.
  const [saving, setSaving] = useState<null | "draft" | "publish">(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  // A product created from /panel/product/new starts unpublished, so the bar
  // offers "Simpan draft" + "Publish" until it goes live once.
  const [isPublished, setIsPublished] = useState(published);

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
      setZipError(err instanceof Error ? err.message : t("product.uploadFailed"));
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
      setStoryError(err instanceof Error ? err.message : t("product.uploadFailed"));
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
      setStoryErrorDark(err instanceof Error ? err.message : t("product.uploadFailed"));
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
      setMessage({ type: "ok", text: t("product.epubUploaded") });
    } catch (err) {
      setEpubError(err instanceof Error ? err.message : t("product.uploadFailed"));
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
      setStoryEpubError(err instanceof Error ? err.message : t("product.uploadFailed"));
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
        setThumbError(t("product.imageOnly"));
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
        setThumbWideError(t("product.imageOnly"));
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
        setExtraError(t("product.imageOnly"));
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

  /**
   * One save path for both buttons. `publish` only adds a step: the fields are
   * written exactly the same way, then the product is flipped visible — so
   * "Simpan draft" and "Publish" can never persist different data.
   */
  async function handleSaveAll(publish = false) {
    // Each failure also reveals the tab holding the offending field: the action
    // bar no longer floats over the panels, so an error about a hidden tab would
    // otherwise point at nothing the seller can see.
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTab("detail");
      setMessage({ type: "err", text: t("product.errTitleEmpty") });
      return;
    }
    if (previewType === "pdf" && !previewUrl.trim() && !previewUrlDark.trim()) {
      setTab("preview");
      setMessage({ type: "err", text: t("product.errNeedPdf") });
      return;
    }
    if (previewType === "excerpt" && !storyEpubUrl.trim()) {
      setTab("preview");
      setMessage({ type: "err", text: t("product.errNeedBuyerEpub") });
      return;
    }
    if (previewType === "epub" && !previewUrl.trim()) {
      setTab("preview");
      setMessage({ type: "err", text: t("product.errNeedEpub") });
      return;
    }
    if (previewType === "link" && !previewUrl.trim()) {
      setTab("preview");
      setMessage({ type: "err", text: t("product.errNeedUrl") });
      return;
    }
    if (
      previewType === "deliverable" &&
      !((deliverableType === "epub" && storyEpubUrl.trim()) || (deliverableType === "pdf" && storyUrl.trim()))
    ) {
      setTab("preview");
      setMessage({
        type: "err",
        text: t("product.errNeedDeliverable"),
      });
      return;
    }
    if (actionType === "link" && !purchaseLink.trim()) {
      setTab("harga");
      setMessage({ type: "err", text: t("product.errNeedCtaUrl") });
      return;
    }
    if (actionType === "calendar" && !eventStart.trim()) {
      setTab("harga");
      setMessage({ type: "err", text: t("product.errNeedEventStart") });
      return;
    }
    if (scheduleEnabled && !availableAt.trim()) {
      setTab("jadwal");
      setMessage({ type: "err", text: t("product.errNeedReleaseDate") });
      return;
    }
    setSaving(publish ? "publish" : "draft");
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
        // `featured` is deliberately absent: pinning moved out of this form, and
        // the update is a partial one, so leaving the key out preserves whatever
        // the product already had instead of silently unpinning it.
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
      if (publish && !isPublished) {
        await setLandingPagePublished(pageId, true);
        setIsPublished(true);
        setMessage({ type: "ok", text: t("product.published") });
      } else {
        setMessage({
          type: "ok",
          text: isPublished ? t("product.changesSaved") : t("product.draftSaved"),
        });
      }
      router.refresh();
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : t("common.failed") });
    } finally {
      setSaving(null);
    }
  }

  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-5 pb-4">
      {/* Tabs */}
      <div className="sticky top-0 z-20 -mx-3 flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--card)]/95 px-3 py-1.5 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-1 sm:shadow-sm">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === item.key
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-foreground"
            }`}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {/* ========================= Tab: Detail ========================= */}
      <DetailTab
        className={tab === "detail" ? PANEL_CLASS : "hidden"}
        title={title}
        setTitle={setTitle}
        categories={categories}
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        initialLongDescription={initial.long_description ?? ""}
        longDescription={longDescription}
        setLongDescription={setLongDescription}
      />

      {/* ========================= Tab: Thumbnail ========================= */}
      {/* Ordered the way a seller fills them in: the mandatory square first, then
          the optional wide variant, then the extra checkout slides. */}
      <ThumbnailTab
        className={tab === "thumbnail" ? PANEL_CLASS : "hidden"}
        title={title}
        thumbnailUrl={thumbnailUrl}
        thumbMeta={thumbMeta}
        thumbUploading={thumbUploading}
        thumbError={thumbError}
        thumbDragging={thumbDragging}
        setThumbDragging={setThumbDragging}
        thumbInputRef={thumbInputRef}
        uploadThumbFile={uploadThumbFile}
        removeThumb={removeThumb}
        thumbWideUrl={thumbWideUrl}
        thumbWideMeta={thumbWideMeta}
        thumbWideUploading={thumbWideUploading}
        thumbWideError={thumbWideError}
        thumbWideDragging={thumbWideDragging}
        setThumbWideDragging={setThumbWideDragging}
        thumbWideInputRef={thumbWideInputRef}
        uploadThumbWideFile={uploadThumbWideFile}
        removeThumbWide={removeThumbWide}
        extraUrls={extraUrls}
        extraSizes={extraSizes}
        extraUploading={extraUploading}
        extraError={extraError}
        extraInputRef={extraInputRef}
        uploadExtraFile={uploadExtraFile}
        removeExtra={removeExtra}
      />

      {/* ========================= Tab: Preview ========================= */}
      <PreviewTab
        className={tab === "preview" ? PANEL_CLASS : "hidden"}
        pageId={pageId}
        initialHtml={initialHtml}
        previewType={previewType}
        pickPreviewType={pickPreviewType}
        previewUrl={previewUrl}
        setPreviewUrl={setPreviewUrl}
        previewUrlDark={previewUrlDark}
        setPreviewUrlDark={setPreviewUrlDark}
        pdfMeta={pdfMeta}
        setPdfMeta={setPdfMeta}
        pdfMetaDark={pdfMetaDark}
        setPdfMetaDark={setPdfMetaDark}
        epubMeta={epubMeta}
        epubUploading={epubUploading}
        epubError={epubError}
        handlePreviewEpubUpload={handlePreviewEpubUpload}
        removePreviewEpub={removePreviewEpub}
        deliverableType={deliverableType}
        setDeliverableType={setDeliverableType}
        storyUrl={storyUrl}
        storyMeta={storyMeta}
        storyUploading={storyUploading}
        storyError={storyError}
        handleStoryUpload={handleStoryUpload}
        removeStory={removeStory}
        storyEpubUrl={storyEpubUrl}
        storyEpubMeta={storyEpubMeta}
        storyEpubUploading={storyEpubUploading}
        storyEpubError={storyEpubError}
        handleStoryEpubUpload={handleStoryEpubUpload}
        removeStoryEpub={removeStoryEpub}
        cutPercent={cutPercent}
        setCutPercent={setCutPercent}
        purging={purging}
        purged={purged}
        runPurge={runPurge}
        previewLabel={previewLabel}
        setPreviewLabel={setPreviewLabel}
        setMessage={setMessage}
      />

      {/* ========================= Tab: Harga ========================= */}
      <PriceTab
        className={tab === "harga" ? PANEL_CLASS : "hidden"}
        isFree={isFree}
        setIsFree={setIsFree}
        price={price}
        setPrice={setPrice}
        priceDiscount={priceDiscount}
        setPriceDiscount={setPriceDiscount}
        discountPct={discountPct}
        actionType={actionType}
        setActionType={setActionType}
        purchaseLink={purchaseLink}
        setPurchaseLink={setPurchaseLink}
        eventTitle={eventTitle}
        setEventTitle={setEventTitle}
        eventStart={eventStart}
        setEventStart={setEventStart}
        eventEnd={eventEnd}
        setEventEnd={setEventEnd}
        eventLocation={eventLocation}
        setEventLocation={setEventLocation}
        eventDescription={eventDescription}
        setEventDescription={setEventDescription}
        title={title}
        ctaLabel={ctaLabel}
        setCtaLabel={setCtaLabel}
        ctaNote={ctaNote}
        setCtaNote={setCtaNote}
        defaultCtaLabel={defaultCtaLabel}
        defaultCtaNote={defaultCtaNote}
        labelPresets={labelPresets}
        notePresets={notePresets}
      />

      {/* ========================= Tab: Jadwal ========================= */}
      <ScheduleTab
        className={tab === "jadwal" ? PANEL_CLASS : "hidden"}
        enabled={scheduleEnabled}
        onEnabledChange={setScheduleEnabled}
        availableAt={availableAt}
        onAvailableAtChange={setAvailableAt}
      />

      {/* ========================= Tab: Pengiriman ========================= */}      <DeliveryTab
        className={tab === "pengiriman" ? PANEL_CLASS : "hidden"}
        deliverableType={deliverableType}
        setDeliverableType={setDeliverableType}
        zipUrl={zipUrl}
        zipMeta={zipMeta}
        zipUploading={zipUploading}
        zipError={zipError}
        handleZipUpload={handleZipUpload}
        removeZip={removeZip}
        storyUrl={storyUrl}
        storyMeta={storyMeta}
        storyUploading={storyUploading}
        storyError={storyError}
        handleStoryUpload={handleStoryUpload}
        removeStory={removeStory}
        storyUrlDark={storyUrlDark}
        storyMetaDark={storyMetaDark}
        storyUploadingDark={storyUploadingDark}
        storyErrorDark={storyErrorDark}
        handleStoryUploadDark={handleStoryUploadDark}
        removeStoryDark={removeStoryDark}
        storyEpubUrl={storyEpubUrl}
        storyEpubMeta={storyEpubMeta}
        storyEpubUploading={storyEpubUploading}
        storyEpubError={storyEpubError}
        handleStoryEpubUpload={handleStoryEpubUpload}
        removeStoryEpub={removeStoryEpub}
        relatedOptions={relatedOptions}
        bundleIds={bundleIds}
        setBundleIds={setBundleIds}
        bundleSearch={bundleSearch}
        setBundleSearch={setBundleSearch}
        bundleNote={bundleNote}
        setBundleNote={setBundleNote}
      />

      {/* ========================= Tab: Terkait ========================= */}
      <RelatedTab
        className={tab === "terkait" ? PANEL_CLASS : "hidden"}
        relatedOptions={relatedOptions}
        relatedIds={relatedIds}
        toggleRelated={toggleRelated}
        relatedSearch={relatedSearch}
        onRelatedSearchChange={setRelatedSearch}
        seriesSearch={seriesSearch}
        onSeriesSearchChange={setSeriesSearch}
        seriesMatches={seriesMatches}
        selectedNext={selectedNext}
        onNextProductIdChange={setNextProductId}
      />

      {/* ===================== Action bar ==================================== */}
      {/* Sits at the end of the form, not floating over it — it used to cover the
          bottom of every panel on short screens. */}
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 shadow-sm sm:gap-3 sm:px-4">
        {!isPublished && !message && (
          <span className="min-w-0 flex-1 text-xs text-[var(--muted)]">
            {t("product.stillDraft")}
          </span>
        )}
        {message && (
          <span
            className={`min-w-0 flex-1 text-sm ${
              message.type === "ok"
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {message.text}
          </span>
        )}
        <Button
          variant="secondary"
          onClick={() => router.push("/panel/products")}
          disabled={!!saving}
          className="hidden sm:inline-flex"
        >
          {t("common.cancel")}
        </Button>
        {isPublished ? (
          <Button
            onClick={() => handleSaveAll(false)}
            loading={saving === "draft"}
            disabled={!!saving}
            className="shrink-0"
          >
            {saving ? t("common.saving") : (
              <>
                <span className="sm:hidden">{t("common.save")}</span>
                <span className="hidden sm:inline">{t("product.saveChanges")}</span>
              </>
            )}
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => handleSaveAll(false)}
              loading={saving === "draft"}
              disabled={!!saving}
              className="shrink-0"
            >
              {saving === "draft" ? t("common.saving") : t("product.saveDraft")}
            </Button>
            <Button
              onClick={() => handleSaveAll(true)}
              loading={saving === "publish"}
              disabled={!!saving}
              className="shrink-0"
            >
              {saving === "publish" ? t("product.publishing") : t("panel.publish")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

/**
 * How much of the book to withhold. This was a range slider, which is the wrong
 * control for a value people want to land EXACTLY on — dragging to 50 and getting
 * 45 is the whole complaint. Presets cover the values actually used, the number
 * box takes a typed answer, and ± steps by 5.
 *
 * Typing needs a raw buffer: clamping every keystroke turns "45" into "5" the
 * moment the "4" lands. So the draft is only committed once it reads as an
 * in-range number, and on blur.
 */
