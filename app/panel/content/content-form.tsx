"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { SaveBar } from "@/components/ui/save-bar";
import { FileUploadCard, type FileMeta } from "@/components/file-upload-card";
import { updateSiteContent } from "@/lib/actions/site-settings";
import { uploadLibraryAsset } from "@/lib/actions/assets";
import {
  DEFAULT_CONTENT,
  type SiteContent,
  type HowToStep,
  type FaqItem,
  type FounderCard,
} from "@/lib/content-config";
import { useT } from "@/lib/i18n/client";

const labelCls = "block text-xs font-medium text-[var(--muted)] mb-1.5";
const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
const sectionCls =
  "rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm space-y-4";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold tracking-tight text-foreground">{children}</h2>;
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-medium text-[var(--primary)] hover:underline"
    >
      + {children}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("common.delete")}
      className="shrink-0 rounded-lg p-2 text-[var(--muted)] hover:text-red-600 hover:bg-[var(--background)] transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

export function ContentForm({ initialContent, siteId }: { initialContent: SiteContent; siteId: string }) {
  const t = useT();
  const [content, setContent] = useState<SiteContent>(initialContent);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  // Local to the card rather than the page-wide banner: an upload error belongs next
  // to the control that caused it, and the card has a slot for exactly that.
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<FileMeta | null>(null);

  function set<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setContent((c) => ({ ...c, [key]: value }));
    setStatus(null);
  }

  function setFounder(patch: Partial<FounderCard>) {
    set("founder", { ...content.founder, ...patch });
  }

  const [coverMeta, setCoverMeta] = useState<{ name: string; size: number } | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

/**
 * Average colour of the cover's top strip, for the browser toolbar.
 *
 * The top strip rather than the whole image, because that is the edge the
 * toolbar actually touches — averaging the whole picture blends a dark sky with
 * a bright foreground into a grey that matches neither.
 *
 * Best effort: a cross-origin image with no CORS headers taints the canvas and
 * getImageData throws, in which case the field simply stays as it was and can be
 * filled by hand.
 */
async function sampleTopColor(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => resolve("");
    img.onload = () => {
      try {
        const w = 32;
        const h = Math.max(1, Math.round((img.height / img.width) * w));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve("");
        ctx.drawImage(img, 0, 0, w, h);
        const strip = Math.max(1, Math.round(h * 0.15));
        const { data } = ctx.getImageData(0, 0, w, strip);
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
        resolve(`#${hex(r)}${hex(g)}${hex(b)}`);
      } catch {
        resolve("");
      }
    };
    img.src = url;
  });
}

  async function handleFounderCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverUploading(true);
    setCoverError(null);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadLibraryAsset(fd);
      if ("error" in res) {
        setCoverError(res.error);
        return;
      }
      setCoverMeta({ name: file.name, size: file.size });
      // Sampled here, not on the server: the bytes are already in the browser.
      const sampled = await sampleTopColor(res.url);
      setFounder(sampled ? { coverUrl: res.url, coverThemeColor: sampled } : { coverUrl: res.url });
    } catch {
      setCoverError(t("content.coverUploadFailed"));
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleFounderPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Cleared first: the card re-uses one input for "Pilih file" and "Ganti file", so a
    // second pick of the SAME filename fires no change event unless the value is reset.
    e.target.value = "";
    if (!file) return;
    setPhotoUploading(true);
    setPhotoError(null);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadLibraryAsset(fd);
      if ("error" in res) {
        setPhotoError(res.error);
        return;
      }
      setPhotoMeta({ name: file.name, size: file.size });
      setFounder({ photoUrl: res.url });
    } catch {
      setPhotoError(t("content.photoUploadFailed"));
    } finally {
      setPhotoUploading(false);
    }
  }

  // Generic helpers for the string-array fields.
  type StrListKey = "licenseParagraphs" | "supportPoints" | "publisherTerms";

  function setStr(key: StrListKey, i: number, value: string) {
    set(key, content[key].map((x, idx) => (idx === i ? value : x)));
  }
  function addStr(key: StrListKey) {
    set(key, [...content[key], ""]);
  }
  function removeStr(key: StrListKey, i: number) {
    set(key, content[key].filter((_, idx) => idx !== i));
  }

  function setStep(i: number, patch: Partial<HowToStep>) {
    set("howToSteps", content.howToSteps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function setFaq(i: number, patch: Partial<FaqItem>) {
    set("faqs", content.faqs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  // Which group is open. Not in the URL: this is a settings page reached from
  // one nav entry, and a shareable link to "the FAQ tab" is not a thing anyone
  // has ever needed.
  const [tab, setTab] = useState<"founder" | "pages" | "buyer" | "legal" | "footer">("founder");

  const dirty = JSON.stringify(content) !== JSON.stringify(initialContent);

  function handleSave() {
    startTransition(async () => {
      setStatus(await updateSiteContent(content, siteId));
    });
  }

  return (
    <div className="space-y-6">
      {/* Four groups by what someone came to change, not by the order these
          fields were built. Seven sections in one 600-line scroll meant the
          FAQ lived below three screens of founder card, and nobody scrolls
          a settings page looking for a field they cannot see. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <button
          type="button"
          onClick={() => setTab("founder")}
          aria-pressed={tab === "founder"}
          className={`rounded-xl px-3 py-2.5 text-left transition-colors ${
            tab === "founder"
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "bg-[var(--accent-subtle)] text-foreground hover:bg-[var(--primary)]/15"
          }`}
        >
          <span className="block text-sm font-semibold">{t("content.tabFounder")}</span>
          <span className={`mt-0.5 block text-xs ${tab === "founder" ? "opacity-80" : "text-[var(--muted)]"}`}>
            {t("content.tabFounderSub")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("pages")}
          aria-pressed={tab === "pages"}
          className={`rounded-xl px-3 py-2.5 text-left transition-colors ${
            tab === "pages"
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "bg-[var(--accent-subtle)] text-foreground hover:bg-[var(--primary)]/15"
          }`}
        >
          <span className="block text-sm font-semibold">{t("content.tabPages")}</span>
          <span className={`mt-0.5 block text-xs ${tab === "pages" ? "opacity-80" : "text-[var(--muted)]"}`}>
            {t("content.tabPagesSub")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("buyer")}
          aria-pressed={tab === "buyer"}
          className={`rounded-xl px-3 py-2.5 text-left transition-colors ${
            tab === "buyer"
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "bg-[var(--accent-subtle)] text-foreground hover:bg-[var(--primary)]/15"
          }`}
        >
          <span className="block text-sm font-semibold">{t("content.tabBuyer")}</span>
          <span className={`mt-0.5 block text-xs ${tab === "buyer" ? "opacity-80" : "text-[var(--muted)]"}`}>
            {t("content.tabBuyerSub")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("legal")}
          aria-pressed={tab === "legal"}
          className={`rounded-xl px-3 py-2.5 text-left transition-colors ${
            tab === "legal"
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "bg-[var(--accent-subtle)] text-foreground hover:bg-[var(--primary)]/15"
          }`}
        >
          <span className="block text-sm font-semibold">{t("content.tabLegal")}</span>
          <span className={`mt-0.5 block text-xs ${tab === "legal" ? "opacity-80" : "text-[var(--muted)]"}`}>
            {t("content.tabLegalSub")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("footer")}
          aria-pressed={tab === "footer"}
          className={`rounded-xl px-3 py-2.5 text-left transition-colors ${
            tab === "footer"
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "bg-[var(--accent-subtle)] text-foreground hover:bg-[var(--primary)]/15"
          }`}
        >
          <span className="block text-sm font-semibold">{t("content.tabFooter")}</span>
          <span className={`mt-0.5 block text-xs ${tab === "footer" ? "opacity-80" : "text-[var(--muted)]"}`}>
            {t("content.tabFooterSub")}
          </span>
        </button>
      </div>

      {tab === "founder" && (
        <div className="space-y-6">
      {/* Kartu kredibilitas founder */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>{t("content.founderCard")}</SectionTitle>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
            <input
              type="checkbox"
              checked={content.founder.enabled}
              onChange={(e) => setFounder({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            {t("content.show")}
          </label>
        </div>
        <p className="text-xs text-[var(--muted)]">
          {t("content.founderCardIntro")}
        </p>

        {/* FileUploadCard, like every other file input in the panel. This one used to
            grow its own control — a hidden <input> behind a bordered label plus a
            separate red "Hapus foto" link — which is exactly the drift the shared card
            exists to stop: different empty state, different remove affordance, no
            filename, no size, and errors landing in the page-wide banner instead of
            next to the field. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <FileUploadCard
            label={t("content.founderPhoto")}
            hint={t("content.founderPhotoHint")}
            accept="image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg"
            badge="IMG"
            badgeClass="bg-[var(--primary)]/10 text-[var(--primary)]"
            url={content.founder.photoUrl}
            meta={photoMeta}
            uploading={photoUploading}
            error={photoError}
            statusText={t("content.attached")}
            preview={
              <div className="mb-2 flex justify-center">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--background)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={content.founder.photoUrl}
                    alt={t("content.founderPhoto")}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            }
            onUpload={handleFounderPhoto}
            onRemove={() => {
              setPhotoMeta(null);
              setPhotoError(null);
              setFounder({ photoUrl: "" });
            }}
          />

          <FileUploadCard
            label={t("content.cover")}
            hint={t("content.coverHint")}
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            badge="IMG"
            badgeClass="bg-[var(--primary)]/10 text-[var(--primary)]"
            url={content.founder.coverUrl}
            meta={coverMeta}
            uploading={coverUploading}
            error={coverError}
            statusText={t("content.attached")}
            preview={
              <div className="mb-2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={content.founder.coverUrl}
                  alt={t("content.cover")}
                  className="h-20 w-full object-cover"
                />
              </div>
            }
            onUpload={handleFounderCover}
            onRemove={() => {
              setCoverMeta(null);
              setCoverError(null);
              setFounder({ coverUrl: "" });
            }}
          />

          <div>
            <label className={labelCls} htmlFor="content-toolbar-color">{t("content.toolbarColor")}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={content.founder.coverThemeColor || "#ffffff"}
                onChange={(e) => setFounder({ coverThemeColor: e.target.value })}
                aria-label={t("content.toolbarColorPick")}
                className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--background)] p-1"
              />
              <input
                id="content-toolbar-color"
                className={inputCls}
                value={content.founder.coverThemeColor}
                onChange={(e) => setFounder({ coverThemeColor: e.target.value })}
                placeholder="#1b2a4a"
              />
            </div>
            <p className="mt-1.5 text-[0.6875rem] text-[var(--muted)]">
              {t("content.toolbarColorHint")}
            </p>
          </div>

          {/* Kept alongside the upload, not replaced by it: the DEFAULT photo is
              /pas_foto.png, a file in public/, and there is no way to reach that — or
              any other already-hosted image — through an upload control. */}
          <div>
            <label className={labelCls} htmlFor="content-photo-url">{t("content.orPasteUrl")}</label>
            <input
              id="content-photo-url"
              className={inputCls}
              value={content.founder.photoUrl}
              onChange={(e) => {
                setPhotoMeta(null);
                setPhotoError(null);
                setFounder({ photoUrl: e.target.value });
              }}
              placeholder={t("content.photoUrlPlaceholder")}
            />
            <p className="mt-1.5 text-[0.6875rem] text-[var(--muted)]">
              {t("content.photoUrlHint")}
            </p>
            {!content.founder.photoUrl && (
              <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] text-sm font-semibold">
                  {content.founder.name.trim().charAt(0).toUpperCase() || "A"}
                </span>
                {t("content.initialsFallback")}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="content-founder-name">{t("content.name")}</label>
            <input
              id="content-founder-name"
              className={inputCls}
              value={content.founder.name}
              onChange={(e) => setFounder({ name: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>{t("content.verifiedBadge")}</label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={content.founder.verified}
                onChange={(e) => setFounder({ verified: e.target.checked })}
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
              />
              {t("content.verifiedBadgeHint")}
            </label>
          </div>
          <div>
            <label className={labelCls} htmlFor="content-founder-role">{t("content.role")}</label>
            <input
              id="content-founder-role"
              className={inputCls}
              value={content.founder.role}
              onChange={(e) => setFounder({ role: e.target.value })}
              placeholder={t("content.rolePlaceholder")}
            />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="content-founder-bio">{t("content.bio")}</label>
          <textarea
            id="content-founder-bio"
            className={inputCls}
            rows={2}
            value={content.founder.bio}
            onChange={(e) => setFounder({ bio: e.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="content-contact-label">{t("content.contactLabel")}</label>
            <input
              id="content-contact-label"
              className={inputCls}
              value={content.founder.contactLabel}
              onChange={(e) => setFounder({ contactLabel: e.target.value })}
              placeholder={t("content.contactLabelPlaceholder")}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="content-contact-href">{t("content.contactHref")}</label>
            <input
              id="content-contact-href"
              className={inputCls}
              value={content.founder.contactHref}
              onChange={(e) => setFounder({ contactHref: e.target.value })}
              placeholder="/contact"
            />
          </div>
        </div>
      </section>
        </div>
      )}

      {tab === "pages" && (
        <div className="space-y-6">
      {/* Halaman Tentang & Kontak — the two standalone pages whose copy used to
          live in the JSX. The author block on /about is NOT edited here: it reads
          the founder card above, so the person is described once. */}
      <section className={sectionCls}>
        <SectionTitle>{t("content.aboutPage")}</SectionTitle>
        <div>
          <label className={labelCls} htmlFor="content-about-heading">{t("content.pageTitle")}</label>
          <input
            id="content-about-heading"
            className={inputCls}
            value={content.aboutHeading}
            onChange={(e) => set("aboutHeading", e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <label className={labelCls}>{t("content.paragraphs")}</label>
          {content.aboutParagraphs.map((text, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea
                className={inputCls}
                rows={3}
                value={text}
                aria-label={`${t("content.paragraphs")} ${i + 1}`}
                onChange={(e) =>
                  set(
                    "aboutParagraphs",
                    content.aboutParagraphs.map((p, idx) => (idx === i ? e.target.value : p)),
                  )
                }
              />
              <RemoveButton
                onClick={() =>
                  set(
                    "aboutParagraphs",
                    content.aboutParagraphs.filter((_, idx) => idx !== i),
                  )
                }
              />
            </div>
          ))}
          <AddButton onClick={() => set("aboutParagraphs", [...content.aboutParagraphs, ""])}>
            + {t("content.addParagraph")}
          </AddButton>
        </div>
        <div>
          <label className={labelCls} htmlFor="content-about-author-heading">{t("content.authorBlockTitle")}</label>
          <input
            id="content-about-author-heading"
            className={inputCls}
            value={content.aboutAuthorHeading}
            onChange={(e) => set("aboutAuthorHeading", e.target.value)}
          />
          <p className="mt-1.5 text-[0.6875rem] text-[var(--muted)]">
            {t("content.authorBlockHintBefore")}{" "}
            <strong>{t("content.founderCard")}</strong> {t("content.authorBlockHintAfter")}
          </p>
        </div>
      </section>

      <section className={sectionCls}>
        <SectionTitle>{t("content.contactPage")}</SectionTitle>
        <div>
          <label className={labelCls} htmlFor="content-contact-heading">{t("content.pageTitle")}</label>
          <input
            id="content-contact-heading"
            className={inputCls}
            value={content.contactHeading}
            onChange={(e) => set("contactHeading", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="content-contact-intro">{t("content.intro")}</label>
          <textarea
            id="content-contact-intro"
            className={inputCls}
            rows={2}
            value={content.contactIntro}
            onChange={(e) => set("contactIntro", e.target.value)}
          />
        </div>
      </section>

      <section className={sectionCls}>
        <SectionTitle>{t("content.supportContact")}</SectionTitle>
        <p className="text-xs text-[var(--muted)]">
          {t("content.supportContactHint")}
        </p>
        <div>
          <label className={labelCls} htmlFor="content-support-contact-heading">{t("panel.title")}</label>
          <input
            id="content-support-contact-heading"
            className={inputCls}
            value={content.supportContactHeading}
            onChange={(e) => set("supportContactHeading", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="content-support-contact-intro">{t("content.intro")}</label>
          <textarea
            id="content-support-contact-intro"
            className={inputCls}
            rows={2}
            value={content.supportContactIntro}
            onChange={(e) => set("supportContactIntro", e.target.value)}
          />
        </div>
      </section>
        </div>
      )}

      {tab === "buyer" && (
        <div className="space-y-6">
      {/* Cara pembelian */}
      <section className={sectionCls}>
        <SectionTitle>{t("content.howToBuy")}</SectionTitle>
        <div>
          <label className={labelCls} htmlFor="content-howto-heading">{t("panel.title")}</label>
          <input
            id="content-howto-heading"
            className={inputCls}
            value={content.howToHeading}
            onChange={(e) => set("howToHeading", e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <label className={labelCls}>{t("content.steps")}</label>
          {content.howToSteps.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-[12rem_1fr] gap-2">
                <input
                  className={inputCls}
                  value={s.label}
                  onChange={(e) => setStep(i, { label: e.target.value })}
                  placeholder={t("content.stepLabel")}
                  aria-label={`${t("content.stepLabel")} ${i + 1}`}
                />
                <input
                  className={inputCls}
                  value={s.text}
                  onChange={(e) => setStep(i, { text: e.target.value })}
                  placeholder={t("content.stepText")}
                  aria-label={`${t("content.stepText")} ${i + 1}`}
                />
              </div>
              <RemoveButton onClick={() => set("howToSteps", content.howToSteps.filter((_, idx) => idx !== i))} />
            </div>
          ))}
          <AddButton onClick={() => set("howToSteps", [...content.howToSteps, { label: "", text: "" }])}>
            {t("content.addStep")}
          </AddButton>
        </div>
      </section>
      {/* Jaminan support */}
      <section className={sectionCls}>
        <SectionTitle>{t("content.supportPromise")}</SectionTitle>
        <div>
          <label className={labelCls} htmlFor="content-support-heading">{t("panel.title")}</label>
          <input
            id="content-support-heading"
            className={inputCls}
            value={content.supportHeading}
            onChange={(e) => set("supportHeading", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="content-support-intro">{t("content.opening")}</label>
          <textarea
            id="content-support-intro"
            className={inputCls}
            rows={2}
            value={content.supportIntro}
            onChange={(e) => set("supportIntro", e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <label className={labelCls}>{t("content.bullets")}</label>
          {content.supportPoints.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                className={inputCls}
                value={p}
                onChange={(e) => setStr("supportPoints", i, e.target.value)}
                aria-label={`${t("content.bullets")} ${i + 1}`}
              />
              <RemoveButton onClick={() => removeStr("supportPoints", i)} />
            </div>
          ))}
          <AddButton onClick={() => addStr("supportPoints")}>{t("content.addBullet")}</AddButton>
        </div>
        <div>
          <label className={labelCls} htmlFor="content-support-outro">{t("content.closing")}</label>
          <textarea
            id="content-support-outro"
            className={inputCls}
            rows={2}
            value={content.supportOutro}
            onChange={(e) => set("supportOutro", e.target.value)}
          />
        </div>
      </section>
      {/* FAQ */}
      <section className={sectionCls}>
        <SectionTitle>{t("content.faq")}</SectionTitle>
        <div>
          <label className={labelCls} htmlFor="content-faq-heading">{t("panel.title")}</label>
          <input
            id="content-faq-heading"
            className={inputCls}
            value={content.faqHeading}
            onChange={(e) => set("faqHeading", e.target.value)}
          />
        </div>
        <div className="space-y-3">
          {content.faqs.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1 space-y-2 rounded-lg border border-[var(--border)] p-3">
                <input
                  className={inputCls}
                  value={f.q}
                  onChange={(e) => setFaq(i, { q: e.target.value })}
                  placeholder={t("content.question")}
                  aria-label={`${t("content.question")} ${i + 1}`}
                />
                <textarea
                  className={inputCls}
                  rows={2}
                  value={f.a}
                  onChange={(e) => setFaq(i, { a: e.target.value })}
                  placeholder={t("content.answer")}
                  aria-label={`${t("content.answer")} ${i + 1}`}
                />
              </div>
              <RemoveButton onClick={() => set("faqs", content.faqs.filter((_, idx) => idx !== i))} />
            </div>
          ))}
          <AddButton onClick={() => set("faqs", [...content.faqs, { q: "", a: "" }])}>
            {t("content.addQuestion")}
          </AddButton>
        </div>
      </section>
        </div>
      )}

      {tab === "legal" && (
        <div className="space-y-6">
      {/* Ketentuan & lisensi */}
      <section className={sectionCls}>
        <SectionTitle>{t("content.license")}</SectionTitle>
        <div>
          <label className={labelCls} htmlFor="content-license-heading">{t("panel.title")}</label>
          <input
            id="content-license-heading"
            className={inputCls}
            value={content.licenseHeading}
            onChange={(e) => set("licenseHeading", e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <label className={labelCls}>{t("content.paragraphs")}</label>
          {content.licenseParagraphs.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea
                className={inputCls}
                rows={3}
                value={p}
                onChange={(e) => setStr("licenseParagraphs", i, e.target.value)}
                aria-label={`${t("content.paragraphs")} ${i + 1}`}
              />
              <RemoveButton onClick={() => removeStr("licenseParagraphs", i)} />
            </div>
          ))}
          <AddButton onClick={() => addStr("licenseParagraphs")}>{t("content.addParagraph")}</AddButton>
        </div>
      </section>
      {/* Publisher terms — shown inside the publisher application form, not on
          any public page. Edited here because it is site copy like the rest. */}
      <section className={sectionCls}>
        <SectionTitle>{t("content.publisherTerms")}</SectionTitle>
        <p className="text-xs text-[var(--muted)]">
          {t("content.publisherTermsIntro")}
        </p>
        <div>
          <label className={labelCls} htmlFor="content-publisher-terms-heading">{t("panel.title")}</label>
          <input
            id="content-publisher-terms-heading"
            className={inputCls}
            value={content.publisherTermsHeading}
            onChange={(e) => set("publisherTermsHeading", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          {content.publisherTerms.map((term, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 shrink-0 text-xs text-[var(--muted)]">{i + 1}.</span>
              <textarea
                className={inputCls}
                rows={2}
                value={term}
                onChange={(e) => setStr("publisherTerms", i, e.target.value)}
                placeholder={t("content.publisherTermPlaceholder")}
                aria-label={`${t("content.publisherTerms")} ${i + 1}`}
              />
              <RemoveButton onClick={() => removeStr("publisherTerms", i)} />
            </div>
          ))}
          <AddButton onClick={() => addStr("publisherTerms")}>{t("content.addTerm")}</AddButton>
        </div>
      </section>
        </div>
      )}

      {tab === "footer" && (
        <div className="space-y-6">
      {/* Footer */}
      <section className={sectionCls}>
        <SectionTitle>{t("content.tabFooter")}</SectionTitle>
        <div>
          <label className={labelCls} htmlFor="content-footer-tagline">{t("content.footerTagline")}</label>
          <textarea
            id="content-footer-tagline"
            className={inputCls}
            rows={2}
            value={content.footerTagline}
            onChange={(e) => set("footerTagline", e.target.value)}
          />
        </div>
      </section>
        </div>
      )}

      {/* Actions */}
      <SaveBar
        dirty={dirty}
        saving={pending}
        onSave={handleSave}
        saveLabel={t("common.save")}
        savingLabel={t("common.saving")}
        unsavedLabel={t("common.unsavedChanges")}
        saved={!!status?.ok}
        savedLabel={t("common.saved")}
        error={status?.error ?? null}
        onReset={() => {
          setContent(DEFAULT_CONTENT);
          setStatus(null);
        }}
        resetLabel={t("content.resetDefaults")}
        extra={
          <Link href="/" target="_blank" className="text-sm text-[var(--muted)] hover:text-foreground">
            {t("content.viewHomepage")}
          </Link>
        }
      />
    </div>
  );
}
