"use client";

import { RichTextEditor } from "@/components/rich-text-editor";
import { richTextToPlain } from "@/lib/html-sanitize";
import { CheckItem, StoreIcon } from "../icons";
import type { LandingPageCategory } from "@/lib/actions/landing-pages";

/**
 * Judul, kategori, deskripsi — what the product IS, before anything about how it
 * is delivered or priced. First tab because it is the only one a draft cannot
 * be saved without.
 */
export function DetailTab({
  className,
  title,
  setTitle,
  categories,
  categoryId,
  setCategoryId,
  initialLongDescription,
  longDescription,
  setLongDescription,
}: {
  className: string;
  title: string;
  setTitle: (v: string) => void;
  categories: LandingPageCategory[];
  categoryId: string;
  setCategoryId: (v: string) => void;
  initialLongDescription: string;
  longDescription: string;
  setLongDescription: (v: string) => void;
}) {
  return (
  <section className={className}>
    <div>
      <h2 className="text-base font-semibold text-foreground">Detail produk</h2>
      <p className="text-sm text-[var(--muted)]">Judul, kategori, dan deskripsi produk.</p>
    </div>

    {/* Title */}
    <div className="space-y-1.5">
      <label htmlFor="page-title" className="block text-sm font-medium text-foreground">
        Judul (Title)
      </label>
      <input
        id="page-title"
        type="text"
        value={title}
        maxLength={100}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
        placeholder="Judul landing page"
      />
      <p className="text-right text-xs text-[var(--muted)]">{title.length}/100</p>
    </div>

    {/* Long description — rich text (WYSIWYG). Stored as HTML, sanitized on save. */}
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          Deskripsi panjang <span className="text-[var(--muted)]">(tampil di kartu &amp; checkout)</span>
        </span>
        <span className="hidden text-xs text-[var(--muted)] sm:block">
          Bantu pembeli memahami isi produk Anda.
        </span>
      </div>
      <RichTextEditor
        initialHtml={initialLongDescription}
        onChange={setLongDescription}
        placeholder="Penjelasan produk, fitur, atau manfaat…"
      />
      <p className="text-right text-xs text-[var(--muted)]">
        {richTextToPlain(longDescription).length} karakter
      </p>
    </div>

    {/* Category + display info */}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor="category" className="block text-sm font-medium text-foreground">
          Kategori
        </label>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
        >
          <option value="">— Pilih kategori —</option>
          {categories
            .filter((c) => !c.parent_id)
            .map((parent) => {
              const children = categories.filter((c) => c.parent_id === parent.id);
              if (children.length === 0) {
                return (
                  <option key={parent.id} value={parent.id}>
                    {parent.name}
                  </option>
                );
              }
              return (
                <optgroup key={parent.id} label={parent.name}>
                  <option value={parent.id}>{parent.name} — semua</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
        </select>
        <p className="text-xs text-[var(--muted)]">
          Pilih kategori yang paling sesuai dengan produk Anda.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <StoreIcon className="h-4 w-4 text-[var(--primary)]" />
          Bagaimana produk ini akan ditampilkan?
        </p>
        <ul className="space-y-1.5 text-xs text-[var(--muted)]">
          <CheckItem>Judul &amp; deskripsi tampil di kartu produk</CheckItem>
          <CheckItem>Harga diskon akan ditampilkan (jika ada)</CheckItem>
          <CheckItem>Thumbnail tampil di homepage</CheckItem>
        </ul>
      </div>
    </div>

  </section>  );
}
