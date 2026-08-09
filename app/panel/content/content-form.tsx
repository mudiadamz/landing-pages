"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Hapus"
      className="shrink-0 rounded-lg p-2 text-[var(--muted)] hover:text-red-600 hover:bg-[var(--background)] transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

export function ContentForm({ initialContent, siteId }: { initialContent: SiteContent; siteId: string }) {
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
      setCoverError("Gagal mengunggah cover.");
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
      setPhotoError("Gagal mengunggah foto.");
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

  function handleSave() {
    startTransition(async () => {
      setStatus(await updateSiteContent(content, siteId));
    });
  }

  return (
    <div className="space-y-6">
      {/* Footer */}
      <section className={sectionCls}>
        <SectionTitle>Footer</SectionTitle>
        <div>
          <label className={labelCls}>Tagline footer</label>
          <textarea
            className={inputCls}
            rows={2}
            value={content.footerTagline}
            onChange={(e) => set("footerTagline", e.target.value)}
          />
        </div>
      </section>

      {/* Kartu kredibilitas founder */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>Kartu founder</SectionTitle>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
            <input
              type="checkbox"
              checked={content.founder.enabled}
              onChange={(e) => setFounder({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            Tampilkan
          </label>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Kartu bukti pembuat yang tampil di homepage, halaman kategori, dan checkout.
        </p>

        {/* FileUploadCard, like every other file input in the panel. This one used to
            grow its own control — a hidden <input> behind a bordered label plus a
            separate red "Hapus foto" link — which is exactly the drift the shared card
            exists to stop: different empty state, different remove affordance, no
            filename, no size, and errors landing in the page-wide banner instead of
            next to the field. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <FileUploadCard
            label="Foto founder"
            hint="JPG · PNG · WebP · SVG. Dirender sebagai bulatan, jadi foto persegi paling aman."
            accept="image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg"
            badge="IMG"
            badgeClass="bg-[var(--primary)]/10 text-[var(--primary)]"
            url={content.founder.photoUrl}
            meta={photoMeta}
            uploading={photoUploading}
            error={photoError}
            statusText="Terpasang"
            preview={
              <div className="mb-2 flex justify-center">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--background)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={content.founder.photoUrl}
                    alt="Foto founder"
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
            label="Cover / background atas"
            hint="Landscape, mis. 1200×600. Tampil di balik foto & nama di homepage, sampai ke tepi paling atas layar."
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            badge="IMG"
            badgeClass="bg-[var(--primary)]/10 text-[var(--primary)]"
            url={content.founder.coverUrl}
            meta={coverMeta}
            uploading={coverUploading}
            error={coverError}
            statusText="Terpasang"
            preview={
              <div className="mb-2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={content.founder.coverUrl}
                  alt="Cover homepage"
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
            <label className={labelCls}>Warna toolbar browser</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={content.founder.coverThemeColor || "#ffffff"}
                onChange={(e) => setFounder({ coverThemeColor: e.target.value })}
                aria-label="Pilih warna toolbar"
                className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--background)] p-1"
              />
              <input
                className={inputCls}
                value={content.founder.coverThemeColor}
                onChange={(e) => setFounder({ coverThemeColor: e.target.value })}
                placeholder="#1b2a4a"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--muted)]">
              Warna bar atas Safari/Chrome di homepage, diambil otomatis dari bagian
              atas cover saat diunggah. Kosongkan = ikut warna halaman.
            </p>
          </div>

          {/* Kept alongside the upload, not replaced by it: the DEFAULT photo is
              /pas_foto.png, a file in public/, and there is no way to reach that — or
              any other already-hosted image — through an upload control. */}
          <div>
            <label className={labelCls}>Atau tempel path / URL</label>
            <input
              className={inputCls}
              value={content.founder.photoUrl}
              onChange={(e) => {
                setPhotoMeta(null);
                setPhotoError(null);
                setFounder({ photoUrl: e.target.value });
              }}
              placeholder="/pas_foto.png atau https://…"
            />
            <p className="mt-1.5 text-[11px] text-[var(--muted)]">
              Boleh file di <span className="font-mono">public/</span> —{" "}
              <span className="font-mono">/pas_foto.png</span> itu nilai bawaannya.
              Dikosongkan = pakai inisial nama.
            </p>
            {!content.founder.photoUrl && (
              <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] text-sm font-semibold">
                  {content.founder.name.trim().charAt(0).toUpperCase() || "A"}
                </span>
                Tanpa foto, kartu memakai inisial ini.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nama</label>
            <input
              className={inputCls}
              value={content.founder.name}
              onChange={(e) => setFounder({ name: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Centang biru</label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={content.founder.verified}
                onChange={(e) => setFounder({ verified: e.target.checked })}
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
              />
              Tampilkan centang setelah nama
            </label>
          </div>
          <div>
            <label className={labelCls}>Peran / jabatan</label>
            <input
              className={inputCls}
              value={content.founder.role}
              onChange={(e) => setFounder({ role: e.target.value })}
              placeholder="Founder · software developer 15+ tahun"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Deskripsi singkat</label>
          <textarea
            className={inputCls}
            rows={2}
            value={content.founder.bio}
            onChange={(e) => setFounder({ bio: e.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Teks link kontak</label>
            <input
              className={inputCls}
              value={content.founder.contactLabel}
              onChange={(e) => setFounder({ contactLabel: e.target.value })}
              placeholder="Hubungi langsung"
            />
          </div>
          <div>
            <label className={labelCls}>Tujuan link kontak</label>
            <input
              className={inputCls}
              value={content.founder.contactHref}
              onChange={(e) => setFounder({ contactHref: e.target.value })}
              placeholder="/contact"
            />
          </div>
        </div>
      </section>

      {/* Ketentuan & lisensi */}
      <section className={sectionCls}>
        <SectionTitle>Ketentuan & lisensi</SectionTitle>
        <div>
          <label className={labelCls}>Judul</label>
          <input
            className={inputCls}
            value={content.licenseHeading}
            onChange={(e) => set("licenseHeading", e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <label className={labelCls}>Paragraf</label>
          {content.licenseParagraphs.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea
                className={inputCls}
                rows={3}
                value={p}
                onChange={(e) => setStr("licenseParagraphs", i, e.target.value)}
              />
              <RemoveButton onClick={() => removeStr("licenseParagraphs", i)} />
            </div>
          ))}
          <AddButton onClick={() => addStr("licenseParagraphs")}>Tambah paragraf</AddButton>
        </div>
      </section>

      {/* Cara pembelian */}
      <section className={sectionCls}>
        <SectionTitle>Cara pembelian</SectionTitle>
        <div>
          <label className={labelCls}>Judul</label>
          <input
            className={inputCls}
            value={content.howToHeading}
            onChange={(e) => set("howToHeading", e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <label className={labelCls}>Langkah</label>
          {content.howToSteps.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-[12rem_1fr] gap-2">
                <input
                  className={inputCls}
                  value={s.label}
                  onChange={(e) => setStep(i, { label: e.target.value })}
                  placeholder="Label (tebal)"
                />
                <input
                  className={inputCls}
                  value={s.text}
                  onChange={(e) => setStep(i, { text: e.target.value })}
                  placeholder="Keterangan"
                />
              </div>
              <RemoveButton onClick={() => set("howToSteps", content.howToSteps.filter((_, idx) => idx !== i))} />
            </div>
          ))}
          <AddButton onClick={() => set("howToSteps", [...content.howToSteps, { label: "", text: "" }])}>
            Tambah langkah
          </AddButton>
        </div>
      </section>

      {/* Jaminan support */}
      <section className={sectionCls}>
        <SectionTitle>Jaminan support</SectionTitle>
        <div>
          <label className={labelCls}>Judul</label>
          <input
            className={inputCls}
            value={content.supportHeading}
            onChange={(e) => set("supportHeading", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Pembuka</label>
          <textarea
            className={inputCls}
            rows={2}
            value={content.supportIntro}
            onChange={(e) => set("supportIntro", e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <label className={labelCls}>Poin (bullet)</label>
          {content.supportPoints.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <input
                className={inputCls}
                value={p}
                onChange={(e) => setStr("supportPoints", i, e.target.value)}
              />
              <RemoveButton onClick={() => removeStr("supportPoints", i)} />
            </div>
          ))}
          <AddButton onClick={() => addStr("supportPoints")}>Tambah poin</AddButton>
        </div>
        <div>
          <label className={labelCls}>Penutup (diikuti link “halaman Kontak”)</label>
          <textarea
            className={inputCls}
            rows={2}
            value={content.supportOutro}
            onChange={(e) => set("supportOutro", e.target.value)}
          />
        </div>
      </section>

      {/* FAQ */}
      <section className={sectionCls}>
        <SectionTitle>FAQ</SectionTitle>
        <div>
          <label className={labelCls}>Judul</label>
          <input
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
                  placeholder="Pertanyaan"
                />
                <textarea
                  className={inputCls}
                  rows={2}
                  value={f.a}
                  onChange={(e) => setFaq(i, { a: e.target.value })}
                  placeholder="Jawaban"
                />
              </div>
              <RemoveButton onClick={() => set("faqs", content.faqs.filter((_, idx) => idx !== i))} />
            </div>
          ))}
          <AddButton onClick={() => set("faqs", [...content.faqs, { q: "", a: "" }])}>
            Tambah pertanyaan
          </AddButton>
        </div>
      </section>

      {/* Publisher terms — shown inside the publisher application form, not on
          any public page. Edited here because it is site copy like the rest. */}
      <section className={sectionCls}>
        <SectionTitle>Ketentuan publisher</SectionTitle>
        <p className="text-xs text-[var(--muted)]">
          Ditampilkan di formulir pengajuan publisher (Profil → Jadi publisher). Pemohon
          harus mencentang persetujuan sebelum bisa mengirim, dan waktu persetujuannya
          dicatat.
        </p>
        <div>
          <label className={labelCls}>Judul</label>
          <input
            className={inputCls}
            value={content.publisherTermsHeading}
            onChange={(e) => set("publisherTermsHeading", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          {content.publisherTerms.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 shrink-0 text-xs text-[var(--muted)]">{i + 1}.</span>
              <textarea
                className={inputCls}
                rows={2}
                value={t}
                onChange={(e) => setStr("publisherTerms", i, e.target.value)}
                placeholder="Satu poin ketentuan"
              />
              <RemoveButton onClick={() => removeStr("publisherTerms", i)} />
            </div>
          ))}
          <AddButton onClick={() => addStr("publisherTerms")}>Tambah ketentuan</AddButton>
        </div>
      </section>

      {/* Actions */}
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-[var(--border)] bg-[var(--background)] py-3">
        <Button size="md" onClick={handleSave} loading={pending} disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
        <button
          type="button"
          className="text-sm text-[var(--muted)] hover:text-foreground"
          onClick={() => {
            setContent(DEFAULT_CONTENT);
            setStatus(null);
          }}
        >
          Reset ke bawaan
        </button>
        <Link href="/" target="_blank" className="ml-auto text-sm text-[var(--muted)] hover:text-foreground">
          Lihat homepage ↗
        </Link>
        {status?.error && <span className="text-sm text-red-600">{status.error}</span>}
        {status?.ok && <span className="text-sm text-green-600">Tersimpan.</span>}
      </div>
    </div>
  );
}
