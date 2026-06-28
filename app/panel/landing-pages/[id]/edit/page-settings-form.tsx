"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateLandingPageSettings, type PreviewType } from "@/lib/actions/landing-pages";
import { uploadPreviewPdf } from "@/lib/actions/assets";
import { Button } from "@/components/ui/button";

type Props = {
  pageId: string;
  slug: string;
  initial: {
    title: string;
    preview_type: PreviewType;
    preview_url: string | null;
  };
};

const PREVIEW_OPTIONS: { value: PreviewType; label: string; hint: string }[] = [
  { value: "html", label: "HTML editor", hint: "Pakai konten HTML/CSS/JS dari editor di bawah." },
  { value: "pdf", label: "PDF", hint: "Upload file PDF untuk di-embed di halaman preview." },
  { value: "link", label: "Link", hint: "Embed URL eksternal di halaman preview." },
];

export function PageSettingsForm({ pageId, slug, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [previewType, setPreviewType] = useState<PreviewType>(initial.preview_type);
  const [previewUrl, setPreviewUrl] = useState(initial.preview_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);
    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await uploadPreviewPdf(pageId, formData);
      if ("error" in result) {
        setMessage({ type: "err", text: result.error });
      } else {
        setPreviewUrl(result.url);
        setMessage({ type: "ok", text: "PDF terupload. Klik Simpan untuk menerapkan." });
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setMessage({ type: "err", text: "Title tidak boleh kosong." });
      return;
    }
    if ((previewType === "pdf" || previewType === "link") && !previewUrl.trim()) {
      setMessage({
        type: "err",
        text: previewType === "pdf" ? "Upload PDF dulu." : "Isi URL link dulu.",
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateLandingPageSettings(
        pageId,
        {
          title: trimmedTitle,
          preview_type: previewType,
          // Keep the stored URL when it's still relevant; clear it for plain HTML.
          preview_url: previewType === "html" ? null : previewUrl.trim(),
        },
        slug,
      );
      setMessage({ type: "ok", text: "Tersimpan." });
      router.refresh();
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Gagal menyimpan" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-sm space-y-5">
      <h2 className="text-sm font-semibold text-foreground">Pengaturan halaman</h2>

      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="page-title" className="block text-sm font-medium text-foreground">
          Title
        </label>
        <input
          id="page-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          placeholder="Judul landing page"
        />
      </div>

      {/* Preview source */}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-foreground">Sumber preview</span>
        <div className="inline-flex flex-wrap rounded-lg border border-[var(--border)] p-0.5 bg-[var(--background)]">
          {PREVIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPreviewType(opt.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                previewType === opt.value
                  ? "bg-[var(--card)] text-foreground shadow-sm"
                  : "text-[var(--muted)] hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">
          {PREVIEW_OPTIONS.find((o) => o.value === previewType)?.hint}
        </p>
      </div>

      {/* PDF upload */}
      {previewType === "pdf" && (
        <div className="space-y-2">
          <label className="block">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handlePdfUpload}
              disabled={uploading}
              className="hidden"
            />
            <span className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-[var(--border)] rounded-lg text-sm font-medium text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] cursor-pointer transition-colors">
              {uploading ? "Mengupload…" : previewUrl ? "Ganti PDF" : "Pilih file PDF"}
            </span>
          </label>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-[var(--primary)] hover:underline truncate"
              title={previewUrl}
            >
              {previewUrl}
            </a>
          )}
        </div>
      )}

      {/* External link */}
      {previewType === "link" && (
        <div className="space-y-1.5">
          <label htmlFor="preview-link" className="block text-sm font-medium text-foreground">
            URL link
          </label>
          <input
            id="preview-link"
            type="url"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            placeholder="https://contoh.com/halaman"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSave}
          size="md"
          loading={saving}
          disabled={saving || uploading}
          className="py-2.5"
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </Button>
        {message && (
          <span
            className={
              message.type === "ok"
                ? "text-sm text-green-600 dark:text-green-400"
                : "text-sm text-red-600 dark:text-red-400"
            }
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
