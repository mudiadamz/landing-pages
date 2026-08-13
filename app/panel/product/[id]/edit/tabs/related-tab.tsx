"use client";

import { t } from "@/lib/i18n";

type RelatedOption = { id: string; title: string; slug: string };

/**
 * The Terkait tab: which of the seller's other products show at the end of the
 * preview, and which one is the next part of a series.
 *
 * Everything it needs arrives as props — two searches, the picked ids, and the
 * derived matches the parent already computes. The parent keeps the state
 * because the save payload is assembled there; this file owns only how it looks.
 */
export function RelatedTab({
  className,
  relatedOptions,
  relatedIds,
  toggleRelated,
  relatedSearch,
  onRelatedSearchChange,
  seriesSearch,
  onSeriesSearchChange,
  seriesMatches,
  selectedNext,
  onNextProductIdChange,
}: {
  className: string;
  relatedOptions: RelatedOption[];
  relatedIds: string[];
  toggleRelated: (id: string) => void;
  relatedSearch: string;
  onRelatedSearchChange: (v: string) => void;
  seriesSearch: string;
  onSeriesSearchChange: (v: string) => void;
  seriesMatches: RelatedOption[];
  selectedNext: RelatedOption | null;
  onNextProductIdChange: (v: string) => void;
}) {
  return (
        <section className={className}>
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("product.relatedHeading")}</h2>
            <p className="text-sm text-[var(--muted)]">
              Muncul di akhir preview (setelah halaman terakhir). Pilih dari produk Anda sendiri.
            </p>
          </div>

          {/* Related products picker */}
          <div className="space-y-2">
            {relatedOptions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
                {t("product.relatedEmpty")}
              </p>
            ) : (
              <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={relatedSearch}
                    onChange={(e) => onRelatedSearchChange(e.target.value)}
                    placeholder={t("product.relatedSearch")}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                  />
                  <span className="shrink-0 rounded-md bg-[var(--background)] px-2 py-1 text-xs text-[var(--muted)]">
                    {t("product.relatedSelected", { count: relatedIds.length })}
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
                      {t("product.relatedNoMatch")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Series continuation */}
          <div className="space-y-2 border-t border-[var(--border)] pt-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t("product.seriesHeading")}</h2>
              <p className="text-sm text-[var(--muted)]">
                Kalau produk ini bagian dari seri, pilih part berikutnya. Tombol &ldquo;Baca
                kelanjutannya&rdquo; akan muncul di akhir preview supaya pembaca tidak berhenti di sini.
              </p>
            </div>
            {relatedOptions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
                {t("product.seriesEmpty")}
              </p>
            ) : (
              <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
                <input
                  type="text"
                  value={seriesSearch}
                  onChange={(e) => onSeriesSearchChange(e.target.value)}
                  placeholder={t("product.relatedSearch")}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
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
                      onClick={() => onNextProductIdChange("")}
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                )}

                <div className="max-h-56 space-y-0.5 overflow-y-auto">
                  {seriesMatches.map((o) => {
                    const checked = selectedNext?.id === o.id;
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
                          onClick={() => onNextProductIdChange(checked ? "" : o.id)}
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
                      {t("product.relatedNoMatch")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
  );
}
