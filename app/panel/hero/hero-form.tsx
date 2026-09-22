"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { uploadLibraryAsset } from "@/lib/actions/assets";
import { updateHero } from "@/lib/actions/site-settings";
import { DEFAULT_HERO, type HeroConfig, type HeroFeature, type HeroIcon } from "@/lib/hero-config";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

const ICON_OPTIONS: { value: HeroIcon; labelKey: MessageKey }[] = [
  { value: "shield", labelKey: "panel.iconShield" },
  { value: "qr", labelKey: "panel.iconQr" },
  { value: "infinity", labelKey: "panel.iconInfinity" },
  { value: "user", labelKey: "panel.iconUser" },
  { value: "star", labelKey: "panel.iconStar" },
  { value: "download", labelKey: "panel.iconDownload" },
  { value: "clock", labelKey: "panel.iconClock" },
  { value: "check", labelKey: "panel.iconCheck" },
];

const labelCls = "block text-xs font-medium text-[var(--muted)] mb-1.5";
const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";

export function HeroForm({ initialHero, siteId }: { initialHero: HeroConfig; siteId: string }) {
  const t = useT();
  const [hero, setHero] = useState<HeroConfig>(initialHero);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof HeroConfig>(key: K, value: HeroConfig[K]) {
    setHero((h) => ({ ...h, [key]: value }));
    setStatus(null);
  }

  function setFeature(i: number, patch: Partial<HeroFeature>) {
    setHero((h) => ({
      ...h,
      features: h.features.map((f, idx) => (idx === i ? { ...f, ...patch } : f)),
    }));
    setStatus(null);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatus(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadLibraryAsset(fd);
    setUploading(false);
    e.target.value = "";
    if ("error" in res) {
      setStatus({ error: res.error });
    } else {
      set("imageUrl", res.url);
    }
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updateHero(hero, siteId);
      setStatus(res);
    });
  }

  return (
    <div className="space-y-6">
      {/* Badge */}
      <div>
        <label className={labelCls} htmlFor="hero-badge">Badge</label>
        <input
          id="hero-badge"
          className={inputCls}
          value={hero.badge}
          onChange={(e) => set("badge", e.target.value)}
          placeholder={t("panel.heroEyebrowPlaceholder")}
        />
      </div>

      {/* Heading */}
      <div>
        <label className={labelCls} htmlFor="hero-heading">{t("panel.heroHeading")}</label>
        <textarea
          id="hero-heading"
          className={inputCls}
          rows={2}
          value={hero.heading}
          onChange={(e) => set("heading", e.target.value)}
          placeholder={t("panel.heroHeadingPlaceholder")}
        />
      </div>

      {/* Subheading */}
      <div>
        <label className={labelCls} htmlFor="hero-subheading">Deskripsi</label>
        <textarea
          id="hero-subheading"
          className={inputCls}
          rows={3}
          value={hero.subheading}
          onChange={(e) => set("subheading", e.target.value)}
        />
      </div>

      {/* CTAs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="hero-cta1-text">{t("panel.heroCta1Text")}</label>
          <input id="hero-cta1-text" className={inputCls} value={hero.primaryLabel} onChange={(e) => set("primaryLabel", e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="hero-cta1-link">{t("panel.heroCta1Link")}</label>
          <input id="hero-cta1-link" className={inputCls} value={hero.primaryHref} onChange={(e) => set("primaryHref", e.target.value)} placeholder="#templates" />
        </div>
        <div>
          <label className={labelCls} htmlFor="hero-cta2-text">{t("panel.heroCta2Text")}</label>
          <input id="hero-cta2-text" className={inputCls} value={hero.secondaryLabel} onChange={(e) => set("secondaryLabel", e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="hero-cta2-link">{t("panel.heroCta2Link")}</label>
          <input id="hero-cta2-link" className={inputCls} value={hero.secondaryHref} onChange={(e) => set("secondaryHref", e.target.value)} placeholder={t("panel.heroLinkPlaceholder")} />
        </div>
      </div>

      {/* Features */}
      <div>
        <label className={labelCls}>{t("panel.heroBullets")}</label>
        <div className="space-y-3">
          {hero.features.map((f, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr_1fr] gap-2">
              <select
                className={inputCls}
                value={f.icon}
                onChange={(e) => setFeature(i, { icon: e.target.value as HeroIcon })}
                aria-label={`Ikon ${i + 1}`}
              >
                {ICON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </option>
                ))}
              </select>
              <input className={inputCls} value={f.title} onChange={(e) => setFeature(i, { title: e.target.value })} placeholder={t("panel.title")} aria-label={`${t("panel.title")} ${i + 1}`} />
              <input className={inputCls} value={f.subtitle} onChange={(e) => setFeature(i, { subtitle: e.target.value })} placeholder={t("panel.heroSubtitle")} aria-label={`${t("panel.heroSubtitle")} ${i + 1}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Image */}
      <div>
        <label className={labelCls} htmlFor="hero-image-url">{t("panel.heroImage")}</label>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
          <div className="w-40 h-28 rounded-lg border border-[var(--border)] bg-[var(--background)] flex items-center justify-center overflow-hidden shrink-0">
            {hero.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero.imageUrl} alt={t("panel.heroPreviewAlt")} className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-[var(--muted)] px-2 text-center">{t("panel.heroDefaultMockup")}</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input
              id="hero-image-url"
              className={inputCls}
              value={hero.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              placeholder={t("panel.heroImagePlaceholder")}
            />
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--primary)] cursor-pointer hover:opacity-80">
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                {uploading ? t("panel.uploading") : t("panel.uploadImage")}
              </label>
              {hero.imageUrl && (
                <button type="button" className="text-sm text-red-600 hover:opacity-80" onClick={() => set("imageUrl", "")}>
                  {t("common.delete")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
        <Button size="md" onClick={handleSave} loading={pending} disabled={pending || uploading}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
        <button
          type="button"
          className="text-sm text-[var(--muted)] hover:text-foreground"
          onClick={() => {
            setHero(DEFAULT_HERO);
            setStatus(null);
          }}
        >
          {t("content.resetDefaults")}
        </button>
        <Link href="/" target="_blank" className="text-sm text-[var(--muted)] hover:text-foreground ml-auto">
          {t("content.viewHomepage")}
        </Link>
        {status?.error && <span className="text-sm text-red-600">{status.error}</span>}
        {status?.ok && <span className="text-sm text-green-600">{t("common.saved")}</span>}
      </div>
    </div>
  );
}
