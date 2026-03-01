"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateLandingPagePricing } from "@/lib/actions/landing-pages";

type Props = {
  pageId: string;
  initial: {
    price?: number | null;
    price_discount?: number | null;
    is_free?: boolean;
    purchase_link?: string | null;
    purchase_type?: "external" | "internal";
    featured?: boolean;
    thumbnail_url?: string | null;
  };
};

export function PricingForm({ pageId, initial }: Props) {
  const router = useRouter();
  const [price, setPrice] = useState<string>(initial.price != null ? String(initial.price) : "");
  const [priceDiscount, setPriceDiscount] = useState<string>(
    initial.price_discount != null ? String(initial.price_discount) : ""
  );
  const [isFree, setIsFree] = useState(!!initial.is_free);
  const [purchaseLink, setPurchaseLink] = useState(initial.purchase_link ?? "");
  const [purchaseType, setPurchaseType] = useState<"external" | "internal">(
    initial.purchase_type ?? "internal"
  );
  const [featured, setFeatured] = useState(!!initial.featured);
  const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnail_url ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPrice(initial.price != null ? String(initial.price) : "");
    setPriceDiscount(initial.price_discount != null ? String(initial.price_discount) : "");
    setIsFree(!!initial.is_free);
    setPurchaseLink(initial.purchase_link ?? "");
    setPurchaseType(initial.purchase_type ?? "internal");
    setFeatured(!!initial.featured);
    setThumbnailUrl(initial.thumbnail_url ?? "");
  }, [initial]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await updateLandingPagePricing(pageId, {
        price: isFree ? null : (price ? parseFloat(price) : null),
        price_discount: isFree || !priceDiscount ? null : parseFloat(priceDiscount),
        is_free: isFree,
        purchase_link: purchaseType === "external" ? (purchaseLink.trim() || null) : null,
        purchase_type: purchaseType,
        featured,
        thumbnail_url: thumbnailUrl.trim() || null,
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

      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">
          Tipe pembelian
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="purchase_type"
              checked={purchaseType === "external"}
              onChange={() => setPurchaseType("external")}
              className="border-[var(--border)]"
            />
            External (link ke payment gateway)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="purchase_type"
              checked={purchaseType === "internal"}
              onChange={() => setPurchaseType("internal")}
              className="border-[var(--border)]"
            />
            Internal (checkout di situs ini)
          </label>
        </div>
      </div>

      {purchaseType === "external" && (
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">
            Purchase link (payment gateway URL)
          </label>
          <input
            type="url"
            value={purchaseLink}
            onChange={(e) => setPurchaseLink(e.target.value)}
            placeholder="https://pay.example.com/..."
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-background text-foreground text-sm"
          />
        </div>
      )}

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

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="featured"
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
          className="rounded border-[var(--border)]"
        />
        <label htmlFor="featured" className="text-sm text-foreground">
          Show on homepage
        </label>
      </div>

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
