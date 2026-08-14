"use client";

import { ToggleCard } from "@/components/toggle-card";
import { useT } from "@/lib/i18n/client";

/**
 * The Jadwal tab, lifted out of product-edit-form.
 *
 * It reads four values and writes two, which is why it was the first to come
 * out: a tab whose whole contract fits in a props list is one that was never
 * really part of the 2,500-line form, only stored there.
 */
export function ScheduleTab({
  className,
  enabled,
  onEnabledChange,
  availableAt,
  onAvailableAtChange,
}: {
  className: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  availableAt: string;
  onAvailableAtChange: (v: string) => void;
}) {
  const t = useT();
  return (
    <section className={className}>
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {t("product.scheduleHeading")}
        </h2>
        <p className="text-sm text-[var(--muted)]">{t("product.scheduleIntro")}</p>
      </div>

      {/* Scheduled release ("upcoming"): before the time, visitors see only a
          countdown and can't read/buy. */}
      <div className="space-y-3">
        <ToggleCard
          checked={enabled}
          onChange={onEnabledChange}
          title={t("product.scheduleToggle")}
          description={t("product.scheduleToggleHint")}
        />
        {enabled ? (
          <div className="space-y-1.5">
            <label htmlFor="available-at" className="block text-sm font-medium text-foreground">
              {t("product.scheduleWhen")} <span className="text-red-500">*</span>
            </label>
            <input
              id="available-at"
              type="datetime-local"
              value={availableAt}
              onChange={(e) => onAvailableAtChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 sm:max-w-xs"
            />
            <p className="text-xs text-[var(--muted)]">{t("product.scheduleNote")}</p>
          </div>
        ) : (
          <p className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
            {t("product.scheduleNone")}
          </p>
        )}
      </div>
    </section>
  );
}
