"use client";

import { FileUploadCard, type FileMeta } from "@/components/file-upload-card";
import { PresetTextField } from "../preset-text-field";
import { BUNDLE_NOTES } from "../bundle-notes";
import { useT } from "@/lib/i18n/client";

type RelatedOption = { id: string; title: string; slug: string };
import type { DeliverableType } from "../deliverable-type";
import { PRODUCT_TYPES, SERVICE_MODES, deliversFile, type ProductType, type ServiceMode } from "@/lib/product-type";
import type { MessageKey } from "@/lib/i18n";

const TYPE_LABEL: Record<ProductType, MessageKey> = {
  digital: "product.typeDigital",
  physical: "product.typePhysical",
  service: "product.typeService",
};
const TYPE_HINT: Record<ProductType, MessageKey> = {
  digital: "product.typeDigitalHint",
  physical: "product.typePhysicalHint",
  service: "product.typeServiceHint",
};
const MODE_LABEL: Record<ServiceMode, MessageKey> = {
  onsite: "product.serviceOnsite",
  remote: "product.serviceRemote",
  both: "product.serviceBoth",
};

const FIELD =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

/**
 * The Pengiriman tab: the file a buyer actually receives, and the bundle it can
 * be sold as part of.
 *
 * Wider than the other extracted tabs — a deliverable is three upload slots, a
 * dark variant, and a bundle picker — so the props are destructured under the
 * SAME names the form used. That keeps the JSX byte-identical to what it
 * replaced, which is the difference between moving code and rewriting it.
 */
export function DeliveryTab({
  className,
  productType,
  setProductType,
  sku,
  setSku,
  stock,
  setStock,
  unit,
  setUnit,
  serviceDuration,
  setServiceDuration,
  serviceMode,
  setServiceMode,
  fulfillmentNote,
  setFulfillmentNote,
  deliverableType,
  setDeliverableType,
  zipUrl,
  zipMeta,
  zipUploading,
  zipError,
  handleZipUpload,
  removeZip,
  storyUrl,
  storyMeta,
  storyUploading,
  storyError,
  handleStoryUpload,
  removeStory,
  storyUrlDark,
  storyMetaDark,
  storyUploadingDark,
  storyErrorDark,
  handleStoryUploadDark,
  removeStoryDark,
  storyEpubUrl,
  storyEpubMeta,
  storyEpubUploading,
  storyEpubError,
  handleStoryEpubUpload,
  removeStoryEpub,
  relatedOptions,
  bundleIds,
  setBundleIds,
  bundleSearch,
  setBundleSearch,
  bundleNote,
  setBundleNote,
}: {
  className: string;
  productType: ProductType;
  setProductType: (v: ProductType) => void;
  sku: string;
  setSku: (v: string) => void;
  stock: string;
  setStock: (v: string) => void;
  unit: string;
  setUnit: (v: string) => void;
  serviceDuration: string;
  setServiceDuration: (v: string) => void;
  serviceMode: ServiceMode | "";
  setServiceMode: (v: ServiceMode | "") => void;
  fulfillmentNote: string;
  setFulfillmentNote: (v: string) => void;
  deliverableType: DeliverableType;
  setDeliverableType: (v: DeliverableType) => void;
  zipUrl: string;
  zipMeta: FileMeta | null;
  zipUploading: boolean;
  zipError: string | null;
  handleZipUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeZip: () => void;
  storyUrl: string;
  storyMeta: FileMeta | null;
  storyUploading: boolean;
  storyError: string | null;
  handleStoryUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeStory: () => void;
  storyUrlDark: string;
  storyMetaDark: FileMeta | null;
  storyUploadingDark: boolean;
  storyErrorDark: string | null;
  handleStoryUploadDark: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeStoryDark: () => void;
  storyEpubUrl: string;
  storyEpubMeta: FileMeta | null;
  storyEpubUploading: boolean;
  storyEpubError: string | null;
  handleStoryEpubUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeStoryEpub: () => void;
  relatedOptions: RelatedOption[];
  bundleIds: string[];
  setBundleIds: React.Dispatch<React.SetStateAction<string[]>>;
  bundleSearch: string;
  setBundleSearch: (v: string) => void;
  bundleNote: string;
  setBundleNote: (v: string) => void;
}) {
  const t = useT();
  return (
        <section className={className}>
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("product.tabDelivery")}</h2>
            <p className="text-sm text-[var(--muted)]">{t("product.deliveryIntro")}</p>
          </div>

          {/* What kind of thing this is. Everything below reads from it, so it
              sits above them all rather than inside the file block it used to
              be the unstated assumption of. */}
          <div className="space-y-1.5">
            <label htmlFor="product-type" className="block text-sm font-medium text-foreground">
              {t("product.typeLabel")}
            </label>
            <select
              id="product-type"
              value={productType}
              onChange={(e) => setProductType(e.target.value as ProductType)}
              className={`${FIELD} sm:max-w-xs`}
            >
              {PRODUCT_TYPES.map((k) => (
                <option key={k} value={k}>
                  {t(TYPE_LABEL[k])}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--muted)]">{t(TYPE_HINT[productType])}</p>
          </div>

          {/* Physical goods: what the seller calls it, how many are left, and
              what one of them is. Stock left blank means "not tracked" — the
              column's documented NULL, not a zero. */}
          {productType === "physical" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="product-sku" className="block text-sm font-medium text-foreground">
                  {t("product.sku")}
                </label>
                <input
                  id="product-sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  maxLength={60}
                  className={FIELD}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="product-stock" className="block text-sm font-medium text-foreground">
                  {t("product.stock")}
                </label>
                <input
                  id="product-stock"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className={FIELD}
                />
                <p className="text-xs text-[var(--muted)]">{t("product.stockHint")}</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="product-unit" className="block text-sm font-medium text-foreground">
                  {t("product.unit")}
                </label>
                <input
                  id="product-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  maxLength={20}
                  placeholder={t("product.unitPlaceholder")}
                  className={FIELD}
                />
              </div>
            </div>
          )}

          {/* A service has a length and a place, which is as much as this model
              claims to know about one. Booking a specific slot is a calendar,
              and a calendar is not a column. */}
          {productType === "service" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="service-duration" className="block text-sm font-medium text-foreground">
                  {t("product.serviceDuration")}
                </label>
                <input
                  id="service-duration"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={serviceDuration}
                  onChange={(e) => setServiceDuration(e.target.value)}
                  className={FIELD}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="service-mode" className="block text-sm font-medium text-foreground">
                  {t("product.serviceMode")}
                </label>
                <select
                  id="service-mode"
                  value={serviceMode}
                  onChange={(e) => setServiceMode(e.target.value as ServiceMode | "")}
                  className={FIELD}
                >
                  <option value="">{t("product.serviceModeUnset")}</option>
                  {SERVICE_MODES.map((m) => (
                    <option key={m} value={m}>
                      {t(MODE_LABEL[m])}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* What happens after payment, in the seller's own words. Only for the
              kinds where something still has to happen. */}
          {!deliversFile(productType) && (
            <div className="space-y-1.5">
              <label htmlFor="fulfillment-note" className="block text-sm font-medium text-foreground">
                {t("product.fulfillmentNote")}
              </label>
              <input
                id="fulfillment-note"
                value={fulfillmentNote}
                onChange={(e) => setFulfillmentNote(e.target.value)}
                maxLength={160}
                className={FIELD}
              />
              <p className="text-xs text-[var(--muted)]">{t("product.fulfillmentNoteHint")}</p>
            </div>
          )}

          {/* Deliverable — buyer receives one file, either ZIP or PDF. Digital
              products only: the upload slots are not merely useless for a haircut,
              they are a file the download route would then hand out for one. */}
          {deliversFile(productType) && (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("product.deliveryFileHeading")}</h3>
              <p className="text-xs text-[var(--muted)]">{t("product.deliveryFileHint")}</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="deliverable-type" className="block text-sm font-medium text-foreground">
                {t("product.deliveryType")}
              </label>
              <select
                id="deliverable-type"
                value={deliverableType}
                onChange={(e) => setDeliverableType(e.target.value as DeliverableType)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 sm:max-w-xs"
              >
                <option value="zip">{t("product.deliveryZip")}</option>
                <option value="pdf">{t("product.deliveryPdf")}</option>
                <option value="epub">{t("product.deliveryEpub")}</option>
              </select>
              <p className="text-xs text-[var(--muted)]">
                {deliverableType === "zip"
                  ? t("product.deliveryZipHint")
                  : deliverableType === "epub"
                    ? t("product.deliveryEpubHint")
                    : t("product.deliveryPdfHint")}
              </p>
            </div>

            {deliverableType === "zip" ? (
              <FileUploadCard
                label={t("product.deliveryZipLabel")}
                accept=".zip,application/zip,application/x-zip-compressed"
                badge="ZIP"
                badgeClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                url={zipUrl}
                meta={zipMeta}
                uploading={zipUploading}
                error={zipError}
                statusText={t("product.deliveryZipReady")}
                onUpload={handleZipUpload}
                onRemove={removeZip}
              />
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
              <div className="space-y-3">
                <p className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
                  {t("product.deliveryTwoVersionsBefore")}{" "}
                  <strong className="text-foreground">{t("product.light")}</strong> &amp;{" "}
                  <strong className="text-foreground">{t("product.dark")}</strong>.{" "}
                  {t("product.deliveryTwoVersionsAfter")}
                </p>
                <FileUploadCard
                  label={t("product.deliveryPdfLight")}
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
                <FileUploadCard
                  label={t("product.deliveryPdfDark")}
                  accept=".pdf,application/pdf"
                  badge="PDF"
                  badgeClass="bg-slate-500/10 text-slate-600 dark:text-slate-300"
                  url={storyUrlDark}
                  meta={storyMetaDark}
                  uploading={storyUploadingDark}
                  error={storyErrorDark}
                  statusText={t("product.deliveryPdfDarkReady")}
                  onUpload={handleStoryUploadDark}
                  onRemove={removeStoryDark}
                />
              </div>
            )}
          </div>
          )}


          {/* Bundle — buying this product grants everything listed here. */}
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t("product.bundleHeading")}</h2>
              <p className="text-sm text-[var(--muted)]">
                {t("product.bundleIntro")}
              </p>
            </div>

            {relatedOptions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
                {t("product.bundleEmpty")}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    value={bundleSearch}
                    onChange={(e) => setBundleSearch(e.target.value)}
                    placeholder={t("product.relatedSearch")}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                  />
                  <span className="shrink-0 text-xs text-[var(--muted)]">{t("product.relatedSelected", { count: bundleIds.length })}</span>
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
                  label={t("product.bundleNoteLabel")}
                  value={bundleNote}
                  onChange={setBundleNote}
                  options={BUNDLE_NOTES.map((k) => t(k))}
                  placeholder={t("product.bundleNotePlaceholder")}
                  maxLength={120}
                  hint={t("product.bundleNoteHint")}
                />
              </>
            )}
          </div>
        </section>
  );
}
