"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileUploadCard, type FileMeta } from "@/components/file-upload-card";
import { uploadNewEpubClient } from "@/lib/upload-client";
import { createProductFromEpub } from "@/lib/actions/epub-product";
import type { LandingPageCategory } from "@/lib/actions/landing-pages";

/**
 * The short way in, for a book.
 *
 * The full form asks for a title, a slug, a description, a thumbnail, a preview
 * source and a deliverable — six answers an EPUB already contains. This asks for
 * the three it does not: the file, which shelf it goes on, and what it costs.
 *
 * The upload goes straight to Storage rather than through the action, because a
 * Server Action body is capped at ~4.5 MB on Vercel and a book routinely exceeds
 * that. Only the resulting path is submitted.
 */
export function EpubQuickForm({ categories }: { categories: LandingPageCategory[] }) {
  const router = useRouter();

  const [epubPath, setEpubPath] = useState("");
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // The card reuses one input for "pick" and "replace", so the same filename
    // twice fires no change event unless the value is cleared first.
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    setError(null);
    setUploading(true);
    const res = await uploadNewEpubClient(file);
    setUploading(false);

    if ("error" in res) {
      setUploadError(res.error);
      return;
    }
    setEpubPath(res.url);
    setMeta({ name: file.name, size: file.size });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!epubPath || creating) return;

    setError(null);
    setCreating(true);
    const res = await createProductFromEpub({
      epubPath,
      categoryId: categoryId || null,
      price: isFree ? 0 : Number(price.replace(/\D/g, "")) || 0,
      isFree,
    });

    if (!res.ok) {
      setCreating(false);
      setError(res.error);
      return;
    }
    // Straight into the full form: the derived title and blurb are the first
    // thing worth checking, and the product is still a draft until published.
    router.push(`/panel/product/${res.id}/edit`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FileUploadCard
        label="File EPUB"
        hint="Judul, sampul, deskripsi dan preview diambil otomatis dari file ini. Maks 10 MB."
        accept="application/epub+zip,.epub"
        badge="EPUB"
        badgeClass="bg-[var(--primary)]/10 text-[var(--primary)]"
        url={epubPath}
        meta={meta}
        uploading={uploading}
        error={uploadError}
        statusText="Siap diproses"
        onUpload={onUpload}
        onRemove={() => {
          setEpubPath("");
          setMeta(null);
          setUploadError(null);
        }}
      />

      <div>
        <label htmlFor="quick-category" className="mb-1.5 block text-sm font-medium text-foreground">
          Kategori
        </label>
        <select
          id="quick-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          <option value="">— Tanpa kategori —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="quick-price" className="mb-1.5 block text-sm font-medium text-foreground">
          Harga
        </label>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
              Rp
            </span>
            <input
              id="quick-price"
              inputMode="numeric"
              value={price}
              disabled={isFree}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2.5 pl-10 pr-3 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
            />
          </div>
          <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            Gratis
          </label>
        </div>
      </div>

      <div className="rounded-xl bg-[var(--accent-subtle)] px-4 py-3 text-sm text-[var(--muted)]">
        Otomatis dari EPUB: <strong className="text-foreground">judul</strong>,{" "}
        <strong className="text-foreground">sampul</strong>,{" "}
        <strong className="text-foreground">deskripsi</strong>, dan{" "}
        <strong className="text-foreground">preview 70% isi buku</strong>. Semuanya masih
        bisa diubah di form lengkap setelah ini.
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <Button type="submit" size="lg" fullWidth disabled={!epubPath || uploading || creating}>
        {creating ? "Memproses buku…" : "Buat produk"}
      </Button>
    </form>
  );
}
