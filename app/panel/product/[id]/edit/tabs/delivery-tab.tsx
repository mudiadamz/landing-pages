"use client";

import { FileUploadCard, type FileMeta } from "@/components/file-upload-card";
import { PresetTextField } from "../preset-text-field";
import { BUNDLE_NOTES } from "../bundle-notes";

type RelatedOption = { id: string; title: string; slug: string };
type DeliverableType = "zip" | "pdf" | "epub";

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
  return (
        <section className={className}>
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
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 sm:max-w-xs"
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
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
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
  );
}
