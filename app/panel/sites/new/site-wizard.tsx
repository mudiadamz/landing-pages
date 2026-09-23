"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileUploadCard } from "@/components/file-upload-card";
import {
  createSite,
  updateSiteProfile,
  selectPanelSite,
  uploadSiteBrandImage,
} from "@/lib/actions/sites";
import {
  BRAND_ICON_ACCEPT,
  BRAND_LOGO_ACCEPT,
  type BrandImageKind,
} from "@/lib/site-brand";
import type { LandingPageCategory } from "@/lib/actions/landing-pages";
import type { LocaleOption } from "@/lib/i18n/locales";
import { DEFAULT_SKIN } from "@/lib/skin";
import { DomainSetupGuide } from "../domain-setup-guide";

/**
 * Guided "open a new storefront" flow.
 *
 * Creating a site is a two-field insert (host + name), but a storefront that
 * actually renders needs a template, palette, identity and a catalog niche —
 * each of which otherwise lives on a different panel screen with nothing tying
 * them together. This wizard walks those choices in the order someone fills them
 * and commits them in one go: createSite, then updateSiteProfile with everything
 * collected, then points the panel scope at the new site. Uploads happen inline
 * (they are timestamped and harmless if the wizard is abandoned); the row itself
 * is only created on the final step, so a half-finished wizard leaves nothing
 * behind.
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

const STEPS = ["Domain", "Tampilan", "Identitas", "Katalog", "Terbitkan"];

/** Mirror of hostError() in lib/actions/sites.ts, for instant feedback. The
 *  server re-validates — this only keeps the Next button honest. */
function hostError(raw: string): string | null {
  const host = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!host) return "Domain tidak boleh kosong.";
  if (host.length > 253) return "Domain terlalu panjang.";
  if (!/^[a-z0-9.-]+$/.test(host))
    return "Domain hanya boleh huruf, angka, titik, dan tanda hubung.";
  if (!host.includes(".")) return "Domain harus punya titik, contoh: resepku.com.";
  if (host.startsWith("-") || host.endsWith("-") || host.startsWith(".") || host.endsWith("."))
    return "Domain tidak boleh diawali/diakhiri titik atau tanda hubung.";
  return null;
}

export function SiteWizard({
  canonicalHost,
  templates,
  palettes,
  locales,
  rootCategories,
}: {
  canonicalHost: string;
  templates: TemplateOption[];
  palettes: PaletteOption[];
  locales: LocaleOption[];
  rootCategories: LandingPageCategory[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [step, setStep] = useState(0);
  const [host, setHost] = useState("");
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("default");
  const [palette, setPalette] = useState("forest");
  const [paletteTouched, setPaletteTouched] = useState(false);
  const [locale, setLocale] = useState(locales[0]?.key ?? "id");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const hostErr = hostError(host);
  const basicsOk = !hostErr && name.trim().length > 0;

  function pickTemplate(key: string) {
    setTemplate(key);
    // Nudge the palette to the template's suggested one until the admin overrides
    // it — a "seamless" default rather than leaving every niche on forest.
    if (!paletteTouched) {
      const suggested = templates.find((t) => t.key === key)?.defaultPalette;
      if (suggested) setPalette(suggested);
    }
  }

  function toggleCategory(id: string) {
    setCategoryIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  function next() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function publish() {
    setError(null);
    start(async () => {
      const created = await createSite({ host, name });
      if (!created.ok || !created.id) {
        setError(created.error ?? "Gagal membuat storefront.");
        return;
      }
      const id = created.id;
      const profile = await updateSiteProfile(id, {
        name,
        tagline,
        description,
        categoryIds,
        template,
        palette,
        // A new storefront starts on the default style; it is changed later from
        // /panel/branding, next to the palette, rather than adding a step here.
        skin: DEFAULT_SKIN,
        locale,
        logoUrl,
        iconUrl,
      });
      if (!profile.ok) {
        // The row exists; only the details failed. Send them to branding to finish
        // rather than losing the domain.
        setCreatedId(id);
        setError(
          (profile.error ?? "Detail gagal disimpan") +
            " — storefront sudah dibuat, lanjutkan di Identitas & Tampilan.",
        );
        return;
      }
      await selectPanelSite(id);
      setCreatedId(id);
      setDone(true);
      router.refresh();
    });
  }

  // ---- Success / go-live screen ------------------------------------------
  if (done && createdId) {
    const cleanHost = host
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
    return (
      <div className="space-y-4">
        <section className={CARD}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
              ✓
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                Storefront <span className="text-[var(--primary)]">{name}</span> siap
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Barisnya sudah dibuat dan template, palet, serta katalognya tersimpan.
                Tinggal satu langkah di luar aplikasi ini: arahkan DNS domainnya.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
            <span className="text-[var(--muted)]">Domain</span>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <code className="font-mono text-foreground">{cleanHost}</code>
              <a
                href={`https://${cleanHost}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                Buka storefront ↗
              </a>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Belum bisa dibuka sampai DNS-nya menunjuk ke server dan Caddy menerbitkan
              sertifikat pada permintaan pertama.
            </p>
          </div>

          <DomainSetupGuide host={cleanHost} canonicalHost={canonicalHost} />

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => router.push("/panel/branding")}>
              Sunting identitas & tampilan
            </Button>
            <Button onClick={() => router.push("/panel/sites")}>
              Selesai — ke daftar domain
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // ---- Stepper ------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Progress */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {STEPS.map((label, i) => {
          const state = i === step ? "current" : i < step ? "done" : "todo";
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.6875rem] font-semibold ${
                  state === "current"
                    ? "bg-[var(--primary)] text-white"
                    : state === "done"
                      ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                      : "bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span
                className={
                  state === "todo" ? "text-[var(--muted)]" : "text-foreground font-medium"
                }
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="text-[var(--border)]">—</span>}
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Step 1 — Domain & name */}
      {step === 0 && (
        <section className={CARD}>
          <header>
            <h2 className="text-sm font-semibold text-foreground">Domain & nama</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Di mana storefront ini tinggal, dan apa namanya. Sisanya bisa diubah nanti.
            </p>
          </header>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Domain <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="resepku.com"
              autoFocus
              className={INPUT}
            />
            <p className="text-xs text-[var(--muted)]">
              Hostname saja, tanpa https:// atau garis miring. Subdomain juga boleh,
              mis. <span className="font-mono">toko.{canonicalHost}</span>.
            </p>
            {host.trim() && hostErr && (
              <p className="text-xs text-red-600 dark:text-red-400">{hostErr}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Nama situs <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Resepku"
              className={INPUT}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={next} disabled={!basicsOk}>
              Lanjut
            </Button>
          </div>
        </section>
      )}

      {/* Step 2 — Look */}
      {step === 1 && (
        <section className={CARD}>
          <header>
            <h2 className="text-sm font-semibold text-foreground">Tampilan</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Template menentukan strukturnya; palet menentukan warnanya.
            </p>
          </header>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Template</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((tpl) => {
                const active = template === tpl.key;
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => pickTemplate(tpl.key)}
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
                          {c.own ? "" : " bawaan"}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Palet warna</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {palettes.map((p) => {
                const active = palette === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setPalette(p.key);
                      setPaletteTouched(true);
                    }}
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
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Bahasa</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {locales.map((l) => {
                const active = locale === l.key;
                return (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLocale(l.key)}
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
          </div>

          <StepNav onBack={back} onNext={next} />
        </section>
      )}

      {/* Step 3 — Identity */}
      {step === 2 && (
        <section className={CARD}>
          <header>
            <h2 className="text-sm font-semibold text-foreground">Identitas</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Tagline, deskripsi SEO, dan logo/ikon. Semua opsional — kosong = pakai
              bawaan Storefront.
            </p>
          </header>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={120}
              placeholder="Satu kalimat tentang storefront ini"
              className={INPUT}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Deskripsi SEO</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="Dipakai di hasil pencarian & preview tautan"
              className={`${INPUT} resize-y`}
            />
            <p className="text-xs text-[var(--muted)]">
              Sekarang {description.trim().length}/200. Kosong = pakai teks bawaan.
            </p>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Logo & ikon</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <BrandUpload
                kind="logo"
                label="Logo"
                hint="PNG/WebP/SVG, latar transparan"
                url={logoUrl}
                onChange={setLogoUrl}
              />
              <BrandUpload
                kind="icon"
                label="Ikon (favicon/PWA)"
                hint="Persegi, PNG/WebP/SVG (bukan JPEG)"
                url={iconUrl}
                onChange={setIconUrl}
              />
            </div>
          </div>

          <StepNav onBack={back} onNext={next} />
        </section>
      )}

      {/* Step 4 — Catalog niche */}
      {step === 3 && (
        <section className={CARD}>
          <header>
            <h2 className="text-sm font-semibold text-foreground">Katalog</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Kategori mana yang tampil di storefront ini. Katalog produknya dipakai
              bersama semua situs.
            </p>
          </header>

          {rootCategories.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-xs text-[var(--muted)]">
              Belum ada kategori induk. Storefront akan menampilkan seluruh katalog;
              buat kategori nanti di panel.
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
                    checked={categoryIds.includes(c.id)}
                    onChange={() => toggleCategory(c.id)}
                    className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="truncate text-foreground">{c.name}</span>
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-[var(--muted)]">
            <strong className="text-foreground">Kosong</strong> = tampilkan seluruh
            katalog.
          </p>

          <StepNav onBack={back} onNext={next} />
        </section>
      )}

      {/* Step 5 — Review & publish */}
      {step === 4 && (
        <section className={CARD}>
          <header>
            <h2 className="text-sm font-semibold text-foreground">Tinjau & terbitkan</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Periksa sekilas, lalu buat storefront-nya.
            </p>
          </header>

          <dl className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] text-sm">
            <Row label="Domain" value={host.trim() || "—"} mono />
            <Row label="Nama" value={name.trim() || "—"} />
            <Row
              label="Template"
              value={templates.find((t) => t.key === template)?.label ?? template}
            />
            <Row
              label="Palet"
              value={palettes.find((p) => p.key === palette)?.label ?? palette}
            />
            <Row
              label="Bahasa"
              value={locales.find((l) => l.key === locale)?.native ?? locale}
            />
            <Row label="Tagline" value={tagline.trim() || "— (bawaan)"} />
            <Row label="Logo / ikon" value={`${logoUrl ? "logo ✓" : "logo —"} · ${iconUrl ? "ikon ✓" : "ikon —"}`} />
            <Row
              label="Katalog"
              value={
                categoryIds.length === 0
                  ? "Seluruh katalog"
                  : `${categoryIds.length} kategori`
              }
            />
          </dl>

          <div className="flex items-center justify-between gap-2">
            <Button variant="secondary" onClick={back} disabled={pending}>
              Kembali
            </Button>
            <Button onClick={publish} loading={pending} disabled={pending || !basicsOk}>
              Buat storefront
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function StepNav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="secondary" onClick={onBack}>
        Kembali
      </Button>
      <Button onClick={onNext}>Lanjut</Button>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className={`min-w-0 truncate text-right text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

/**
 * One brand image upload — the same pattern as /panel/branding's BrandUpload:
 * FileUploadCard owns the empty/filled/uploading states; the action returns a
 * public URL we stash in wizard state.
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
        setError(res.error ?? "Gagal mengunggah.");
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
