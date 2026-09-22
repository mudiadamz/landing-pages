"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileUploadCard } from "@/components/file-upload-card";
import { updateSiteProfile, uploadSiteBrandImage } from "@/lib/actions/sites";
import {
  BRAND_ICON_ACCEPT,
  BRAND_LOGO_ACCEPT,
  type BrandImageKind,
} from "@/lib/site-brand";
import type { LandingPageCategory } from "@/lib/actions/landing-pages";
import type { SiteProfileInput } from "@/lib/actions/sites";
import type { LocaleOption } from "@/lib/i18n/locales";
import { useT } from "@/lib/i18n/client";

/**
 * Everything about a storefront that isn't its hostname.
 *
 * Grouped into three blocks, in the order someone actually fills them: what it is
 * called, what it looks like, what it sells. The old combined form interleaved these
 * with the host field and the DNS guide, so no section read as finished.
 */

const CARD =
  "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-sm space-y-4";
const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

type TemplateOption = {
  key: string;
  label: string;
  description: string;
  defaultPalette: string | null;
  coverage: { label: string; own: boolean }[];
};
type PaletteOption = {
  key: string;
  label: string;
  note: string;
  swatch: [string, string, string];
};

export function SiteProfileForm({
  siteId,
  host,
  initial,
  rootCategories,
  templates,
  palettes,
  locales,
}: {
  siteId: string;
  host: string;
  initial: SiteProfileInput;
  rootCategories: LandingPageCategory[];
  templates: TemplateOption[];
  palettes: PaletteOption[];
  locales: LocaleOption[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<SiteProfileInput>(initial);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const set = <K extends keyof SiteProfileInput>(key: K, value: SiteProfileInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function toggleCategory(id: string) {
    setDraft((d) => ({
      ...d,
      categoryIds: d.categoryIds.includes(id)
        ? d.categoryIds.filter((x) => x !== id)
        : [...d.categoryIds, id],
    }));
  }

  function save() {
    startTransition(async () => {
      const res = await updateSiteProfile(siteId, draft);
      setMessage(
        res.ok
          ? { type: "ok", text: t("sites.savedPublicLater") }
          : { type: "err", text: res.error ?? t("common.failed") },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {message && (
        <p
          className={`rounded-xl border px-3 py-2.5 text-sm ${
            message.type === "ok"
              ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400"
              : "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* 1 — Identity */}
      <section className={CARD}>
        <header>
          <h2 className="text-sm font-semibold text-foreground">{t("sites.identityHeading")}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {t("sites.identityIntro")}
            {host ? (
              <>
                {" "}
                <span className="font-mono text-foreground">{host}</span>.
              </>
            ) : (
              "."
            )}
          </p>
        </header>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {t("sites.siteName")} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("sites.namePlaceholder")}
            className={INPUT}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Tagline</label>
          <input
            type="text"
            value={draft.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder={t("panel.taglinePlaceholder")}
            maxLength={120}
            className={INPUT}
          />
          <p className="text-xs text-[var(--muted)]">
            {t("sites.taglineHint")}{" "}
            <span className="font-mono">
              {t("sites.taglineExample", { name: draft.name || t("content.name") })}
            </span>
            .
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">{t("panel.seoDescription")}</label>
          <textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            maxLength={200}
            placeholder={t("panel.seoPlaceholder")}
            className={`${INPUT} resize-y`}
          />
          <p className="text-xs text-[var(--muted)]">
            {t("panel.seoHint")}
            Sekarang {draft.description.trim().length}. Kosong = pakai teks bawaan.
          </p>
        </div>

        {/* Two uploads, because they are different shapes with different jobs —
            see lib/site-brand.ts. */}
        <div className="space-y-2">
          <span className="block text-sm font-medium text-foreground">{t("panel.logoAndIcon")}</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandUpload
              kind="logo"
              label={t("panel.logoHeader")}
              hint={t("sites.logoHint")}
              url={draft.logoUrl}
              onChange={(url) => set("logoUrl", url)}
            />
            <BrandUpload
              kind="icon"
              label={t("panel.iconFavicon")}
              hint={t("sites.iconHint")}
              url={draft.iconUrl}
              onChange={(url) => set("iconUrl", url)}
            />
          </div>
          <p className="text-xs text-[var(--muted)]">
            Dikosongkan = pakai lambang Storefront. Perubahan ikon baru terlihat di tab
            setelah browser membuang cache favicon-nya — coba hard reload atau tab baru.
          </p>
        </div>
      </section>

      {/* 2 — Look */}
      <section className={CARD}>
        <header>
          <h2 className="text-sm font-semibold text-foreground">Tampilan</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Template menentukan strukturnya; palet menentukan warnanya.
          </p>
        </header>

        {/* Cards rather than a <select>: the choice is visual, and the one-line
            description is what makes it decidable without previewing. */}
        <div className="space-y-2">
          <span className="block text-sm font-medium text-foreground">Template</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((tpl) => {
              const active = draft.template === tpl.key;
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => set("template", tpl.key)}
                  aria-pressed={active}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/30"
                      : "border-[var(--border)] hover:bg-[var(--background)]"
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground">{tpl.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {tpl.description}
                  </span>
                  {/* Read live from the registry, so a new theme's coverage shows up here
                      without anyone updating this list. "bawaan" = falls back to
                      Marketplace for that surface. */}
                  <span className="mt-2 flex flex-wrap gap-1">
                    {tpl.coverage.map((c) => (
                      <span
                        key={c.label}
                        className={`rounded px-1.5 py-0.5 text-[0.625rem] ${
                          c.own
                            ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                            : "bg-[var(--background)] text-[var(--muted)]"
                        }`}
                      >
                        {c.label}
                        {c.own ? "" : ` ${t("sites.defaultSuffix")}`}
                      </span>
                    ))}
                  </span>
                  {tpl.defaultPalette && (
                    <span className="mt-1.5 block text-[0.625rem] text-[var(--muted)]">
                      {t("sites.suggestedPalette")}{" "}
                      {palettes.find((p) => p.key === tpl.defaultPalette)?.label ??
                        tpl.defaultPalette}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--muted)]">
            {t("sites.templateBadgeNoteBefore")} <em>{t("sites.defaultWord")}</em>{" "}
            {t("sites.templateBadgeNoteAfter")}
          </p>
        </div>

        {/* Swatches, not names: "Jade & Mango" means nothing until you see it. Only
            preset keys are storable — the presets had their contrast measured, free-text
            hex fields per domain would not. */}
        <div className="space-y-2">
          <span className="block text-sm font-medium text-foreground">{t("panel.colourPalette")}</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {palettes.map((p) => {
              const active = draft.palette === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => set("palette", p.key)}
                  aria-pressed={active}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/30"
                      : "border-[var(--border)] hover:bg-[var(--background)]"
                  }`}
                >
                  <span className="mt-0.5 flex shrink-0 gap-1" aria-hidden>
                    {p.swatch.map((c, i) => (
                      <span
                        key={i}
                        className="h-5 w-5 rounded-full border border-black/10 dark:border-white/15"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{p.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{p.note}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--muted)]">
            {t("sites.paletteNote")}
          </p>
        </div>
      </section>

      {/* Language. Sits with the palette rather than in its own screen: both are
          "how this storefront presents itself", and both are one click to change
          and instantly visible. */}
      <section className={CARD}>
        <header>
          <h2 className="text-sm font-semibold text-foreground">{t("nav.language")}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {t("sites.localeNote")}
          </p>
        </header>
        <div className="grid gap-2 sm:grid-cols-2">
          {locales.map((l) => {
            const active = draft.locale === l.key;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => set("locale", l.key)}
                aria-pressed={active}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/30"
                    : "border-[var(--border)] hover:bg-[var(--background)]"
                }`}
              >
                <span className="block text-sm font-medium text-foreground">{l.native}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{l.note}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3 — Catalog */}
      <section className={CARD}>
        <header>
          <h2 className="text-sm font-semibold text-foreground">{t("panel.catalogNiche")}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {t("sites.catalogNote")}
          </p>
        </header>

        {rootCategories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-xs text-[var(--muted)]">
            {t("panel.noRootCategories")}
          </p>
        ) : (
          <div className="space-y-1 rounded-xl border border-[var(--border)] p-2">
            {rootCategories.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--background)]"
              >
                <input
                  type="checkbox"
                  checked={draft.categoryIds.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                  className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                />
                <span className="truncate text-foreground">{c.name}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-[var(--muted)]">
          {t("sites.subcategoriesNote")}{" "}
          <strong className="text-foreground">{t("sites.emptyWord")}</strong> ={" "}
          {t("sites.wholeCatalogNote")}
        </p>
      </section>

      <div className="flex justify-end gap-2">
        <Button onClick={save} loading={pending} disabled={pending}>
          {t("product.saveChanges")}
        </Button>
      </div>
    </div>
  );
}

/**
 * One brand image upload. Uses FileUploadCard like every other file input in the
 * panel — the card owns the empty/filled states, the name, the size, and the
 * replace/remove controls.
 *
 * Removing only clears the column. The stored object stays, deliberately: the page
 * that is still serving the old URL from cache should keep rendering rather than
 * showing a broken image for a minute.
 */
function BrandUpload({
  kind,
  label,
  hint,
  url,
  onChange,
}: {
  kind: BrandImageKind;
  label: string;
  hint: string;
  url: string;
  onChange: (url: string) => void;
}) {
  const t = useT();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ name: string; size?: number } | null>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const res = await uploadSiteBrandImage(form);
      if (!res.ok || !res.url) {
        setError(res.error ?? t("panel.uploadFailed"));
        return;
      }
      setMeta({ name: file.name, size: file.size });
      onChange(res.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <FileUploadCard
      label={label}
      hint={hint}
      accept={kind === "icon" ? BRAND_ICON_ACCEPT : BRAND_LOGO_ACCEPT}
      badge={kind === "icon" ? "ICO" : "IMG"}
      badgeClass="bg-[var(--primary)]/10 text-[var(--primary)]"
      url={url}
      meta={meta}
      uploading={uploading}
      error={error}
      statusText="Terpasang"
      preview={
        url ? (
          // Checkerboard behind it, because both of these are usually transparent and
          // a white logo on a white card looks like a failed upload.
          <div
            className="mb-2 flex items-center justify-center rounded-lg border border-[var(--border)] p-3"
            style={{
              backgroundImage:
                "linear-gradient(45deg,rgba(128,128,128,.18) 25%,transparent 25%,transparent 75%,rgba(128,128,128,.18) 75%),linear-gradient(45deg,rgba(128,128,128,.18) 25%,transparent 25%,transparent 75%,rgba(128,128,128,.18) 75%)",
              backgroundSize: "12px 12px",
              backgroundPosition: "0 0, 6px 6px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className={
                kind === "icon"
                  ? "h-12 w-12 rounded-md object-cover"
                  : "h-10 w-auto max-w-full object-contain"
              }
            />
          </div>
        ) : undefined
      }
      onUpload={handle}
      onRemove={() => {
        setMeta(null);
        setError(null);
        onChange("");
      }}
    />
  );
}
