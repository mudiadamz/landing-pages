"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateLandingPagePricing, type LandingPageCategory } from "@/lib/actions/landing-pages";
import { uploadZip } from "@/lib/actions/downloads";

type Props = {
  pageId: string;
  categories: LandingPageCategory[];
  initial: {
    price?: number | null;
    price_discount?: number | null;
    is_free?: boolean;
    purchase_link?: string | null;
    purchase_type?: "external" | "internal";
    featured?: boolean;
    thumbnail_url?: string | null;
    zip_url?: string | null;
    rating?: number | null;
    category_id?: string | null;
    long_description?: string | null;
  };
};

export function PricingForm({ pageId, categories, initial }: Props) {
  const router = useRouter();
  const [price, setPrice] = useState<string>(initial.price != null ? String(initial.price) : "");
  const [priceDiscount, setPriceDiscount] = useState<string>(
    initial.price_discount != null ? String(initial.price_discount) : ""
  );
  const [isFree, setIsFree] = useState(!!initial.is_free);
  const purchaseType = "internal" as const;
  const featured = !!initial.featured;
  const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnail_url ?? "");
  const [zipUrl, setZipUrl] = useState(initial.zip_url ?? "");
  const rating = initial.rating != null ? String(initial.rating) : "";
  const [categoryId, setCategoryId] = useState<string>(initial.category_id ?? "");
  const [longDescription, setLongDescription] = useState(initial.long_description ?? "");
  const [zipUploading, setZipUploading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPrice(initial.price != null ? String(initial.price) : "");
    setPriceDiscount(initial.price_discount != null ? String(initial.price_discount) : "");
    setIsFree(!!initial.is_free);
    setThumbnailUrl(initial.thumbnail_url ?? "");
    setZipUrl(initial.zip_url ?? "");
    setCategoryId(initial.category_id ?? "");
    setLongDescription(initial.long_description ?? "");
  }, [initial]);

  async function handleZipUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipUploading(true);
    setZipError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await uploadZip(pageId, formData);
      if ("error" in res) {
        setZipError(res.error);
        return;
      }
      setZipUrl(res.url);
      await updateLandingPagePricing(pageId, { zip_url: res.url });
      router.refresh();
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setZipUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await updateLandingPagePricing(pageId, {
        price: isFree ? null : (price ? parseFloat(price) : null),
        price_discount: isFree || !priceDiscount ? null : parseFloat(priceDiscount),
        is_free: isFree,
        purchase_link: null,
        purchase_type: "internal",
        featured,
        thumbnail_url: thumbnailUrl.trim() || null,
        zip_url: zipUrl.trim() || null,
        rating: rating ? parseFloat(rating) : null,
        category_id: categoryId.trim() || null,
        long_description: longDescription.trim() || null,
      });
      setMessage("Pricing saved.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Pricing & Purchase</h3>

      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">
          Deskripsi panjang (tampil di kartu & checkout)
        </label>
        <textarea
          value={longDescription}
          onChange={(e) => setLongDescription(e.target.value)}
          placeholder="Penjelasan produk, fitur, atau manfaat..."
          rows={4}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-background text-foreground text-sm resize-y min-h-[80px]"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_free"
          checked={isFree}
          onChange={(e) => setIsFree(e.target.checked)}
          className="rounded border-[var(--border)]"
        />
        <label htmlFor="is_free" className="text-sm text-foreground">
          Free
        </label>
      </div>

      {!isFree && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              Normal price
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="99.00"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-background text-foreground text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              Discount price
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={priceDiscount}
              onChange={(e) => setPriceDiscount(e.target.value)}
              placeholder="79.00"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-background text-foreground text-sm"
            />
          </div>
        </div>
      )}

      {/* Purchase type is always internal (Duitku checkout) */}

      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">
          File ZIP (untuk download setelah pembayaran)
        </label>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={handleZipUpload}
            disabled={zipUploading}
            className="block w-full text-sm text-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[var(--border)] file:bg-[var(--background)] file:text-sm file:font-medium"
          />
        </div>
        {zipUploading && <p className="mt-1 text-xs text-[var(--muted)]">Mengunggah…</p>}
        {zipError && <p className="mt-1 text-xs text-red-500">{zipError}</p>}
        {zipUrl && (
          <div className="mt-1.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-green-600 dark:text-green-400">ZIP terpasang</span>
            <a
              href={zipUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[var(--primary)] hover:underline"
            >
              Lihat file →
            </a>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">
          Thumbnail URL (untuk preview di homepage)
        </label>
        <input
          type="url"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-background text-foreground text-sm"
        />
      </div>

      {categories.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">
            Kategori
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-[var(--border)] rounded-lg bg-background text-foreground text-sm"
          >
            <option value="">— Pilih kategori —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-sm font-medium hover:opacity-95 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save pricing"}
      </button>

      {message && (
        <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
      )}
    </div>
  );
}
