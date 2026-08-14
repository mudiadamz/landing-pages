"use client";

import { ToggleCard } from "@/components/toggle-card";
import { PresetTextField } from "../preset-text-field";
import { useT } from "@/lib/i18n/client";

/**
 * Harga, dan what the button does.
 *
 * Price and call-to-action sit in one tab because they answer the same
 * question: what happens when a visitor decides to act. A free product, a paid
 * one, an external link and a calendar event are four different answers, and
 * only one set of fields is relevant at a time.
 *
 * Everything here is a controlled string, including the two prices — the form
 * parses them on save. Keeping them as text is what lets the field hold "" and
 * a half-typed number without the input fighting the person typing it.
 */
export function PriceTab({
  className,
  isFree,
  setIsFree,
  price,
  setPrice,
  priceDiscount,
  setPriceDiscount,
  discountPct,
  actionType,
  setActionType,
  purchaseLink,
  setPurchaseLink,
  eventTitle,
  setEventTitle,
  eventStart,
  setEventStart,
  eventEnd,
  setEventEnd,
  eventLocation,
  setEventLocation,
  eventDescription,
  setEventDescription,
  title,
  ctaLabel,
  setCtaLabel,
  ctaNote,
  setCtaNote,
  defaultCtaLabel,
  defaultCtaNote,
  labelPresets,
  notePresets,
}: {
  className: string;
  isFree: boolean;
  setIsFree: (v: boolean) => void;
  price: string;
  setPrice: (v: string) => void;
  priceDiscount: string;
  setPriceDiscount: (v: string) => void;
  discountPct: number | null;
  actionType: "checkout" | "link" | "calendar";
  setActionType: (v: "checkout" | "link" | "calendar") => void;
  purchaseLink: string;
  setPurchaseLink: (v: string) => void;
  eventTitle: string;
  setEventTitle: (v: string) => void;
  eventStart: string;
  setEventStart: (v: string) => void;
  eventEnd: string;
  setEventEnd: (v: string) => void;
  eventLocation: string;
  setEventLocation: (v: string) => void;
  eventDescription: string;
  setEventDescription: (v: string) => void;
  title: string;
  ctaLabel: string;
  setCtaLabel: (v: string) => void;
  ctaNote: string;
  setCtaNote: (v: string) => void;
  defaultCtaLabel: string;
  defaultCtaNote: string;
  labelPresets: string[];
  notePresets: string[];
}) {
  const t = useT();
  return (
  <section className={className}>
    <div>
      <h2 className="text-base font-semibold text-foreground">{t("product.priceHeading")}</h2>
      <p className="text-sm text-[var(--muted)]">{t("product.priceIntro")}</p>
    </div>

    <ToggleCard
      checked={isFree}
      onChange={setIsFree}
      title={t("product.freeToggle")}
      description={t("product.freeToggleHint")}
    />

    {/* Prices */}
    {!isFree && (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">{t("product.priceNormal")}</label>
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
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2.5 pl-12 pr-3 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">{t("product.priceDiscount")}</label>
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
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2.5 pl-12 pr-20 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            />
            {discountPct != null && (
              <span className="absolute inset-y-0 right-2 my-auto flex h-6 items-center rounded-md bg-[var(--primary)]/10 px-2 text-xs font-semibold text-[var(--primary)]">
                {t("product.discountOff", { pct: discountPct })}
              </span>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Preview buy-now card: text overrides + action */}
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("product.ctaHeading")}</h3>
        <p className="text-xs text-[var(--muted)]">
          {t("product.ctaIntroBefore")}{" "}
          <strong className="text-foreground">{t("product.ctaIntroAnd")}</strong>{" "}
          {t("product.ctaIntroAfter")}
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cta-action" className="block text-sm font-medium text-foreground">
          {t("product.ctaAction")}
        </label>
        <select
          id="cta-action"
          value={actionType}
          onChange={(e) => setActionType(e.target.value as "checkout" | "link" | "calendar")}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 sm:max-w-xs"
        >
          <option value="checkout">{t("product.ctaActionCheckout")}</option>
          <option value="link">{t("product.ctaActionLink")}</option>
          <option value="calendar">{t("product.ctaActionCalendar")}</option>
        </select>
        <p className="text-xs text-[var(--muted)]">
          {actionType === "link"
            ? t("product.ctaHintLink")
            : actionType === "calendar"
              ? t("product.ctaHintCalendar")
              : t("product.ctaHintCheckout")}
        </p>
      </div>

      {actionType === "link" && (
        <div className="space-y-1.5">
          <label htmlFor="cta-link" className="block text-sm font-medium text-foreground">
            {t("product.ctaUrl")}
          </label>
          <input
            id="cta-link"
            type="url"
            value={purchaseLink}
            onChange={(e) => setPurchaseLink(e.target.value)}
            placeholder="https://contoh.com/beli"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          />
        </div>
      )}

      {actionType === "calendar" && (
        <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
          <p className="text-xs text-[var(--muted)]">
            {t("product.eventIntro")}
          </p>
          <div className="space-y-1.5">
            <label htmlFor="event-title" className="block text-sm font-medium text-foreground">
              {t("product.eventTitle")}
            </label>
            <input
              id="event-title"
              type="text"
              value={eventTitle}
              maxLength={200}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder={title || t("product.eventTitle")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            />
            <p className="text-xs text-[var(--muted)]">{t("product.eventTitleHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="event-start" className="block text-sm font-medium text-foreground">
                {t("product.eventStart")} <span className="text-red-500">*</span>
              </label>
              <input
                id="event-start"
                type="datetime-local"
                value={eventStart}
                onChange={(e) => setEventStart(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="event-end" className="block text-sm font-medium text-foreground">
                {t("product.eventEnd")}
              </label>
              <input
                id="event-end"
                type="datetime-local"
                value={eventEnd}
                onChange={(e) => setEventEnd(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              />
              <p className="text-xs text-[var(--muted)]">{t("product.eventEndHint")}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="event-location" className="block text-sm font-medium text-foreground">
              {t("product.eventLocation")}
            </label>
            <input
              id="event-location"
              type="text"
              value={eventLocation}
              maxLength={300}
              onChange={(e) => setEventLocation(e.target.value)}
              placeholder={t("product.eventLocationPlaceholder")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="event-desc" className="block text-sm font-medium text-foreground">
              {t("product.eventDescription")}
            </label>
            <textarea
              id="event-desc"
              value={eventDescription}
              maxLength={1000}
              rows={3}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder={t("product.eventDescPlaceholder")}
              className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <PresetTextField
          id="cta-label"
          label={t("product.ctaLabelField")}
          value={ctaLabel}
          onChange={setCtaLabel}
          options={labelPresets}
          placeholder={defaultCtaLabel}
          maxLength={40}
        />
        <PresetTextField
          id="cta-note"
          label={t("product.ctaNoteField")}
          value={ctaNote}
          onChange={setCtaNote}
          options={notePresets}
          placeholder={defaultCtaNote}
          maxLength={80}
        />
      </div>

      <p className="text-xs text-[var(--muted)]">
        {t("product.ctaFooterNote")}
      </p>

    </div>

  </section>  );
}
