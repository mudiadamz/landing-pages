"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { LandingPagePublic } from "@/lib/actions/landing-pages";
import { normalizeDescription } from "@/lib/seo";

type Props = {
  page: LandingPagePublic;
  isLoggedIn?: boolean;
  /** Eager-load + fetch-priority the image (use for the first few above-fold cards). */
  priority?: boolean;
  /** Total review count, for the rating denominator. */
  reviewCount?: number;
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    currencyDisplay: "symbol",
  }).format(value);
}

export function LandingPageCard({ page, priority = false, reviewCount = 0 }: Props) {
  const isFree = page.is_free === true;
  const description = normalizeDescription(page.long_description);
  const price = page.price ?? 0;
  const priceDiscount = page.price_discount ?? 0;
  const hasDiscount = !isFree && priceDiscount > 0;
  const displayPrice = hasDiscount ? priceDiscount : price;
  const showAsFree = isFree || displayPrice <= 0;
  const discountPct = hasDiscount && price > 0 ? Math.round(((price - priceDiscount) / price) * 100) : 0;
  const soldCount = page.sold_count ?? 0;
  const rating = page.rating != null && page.rating > 0 ? Number(page.rating) : null;
  const isInternal = page.purchase_type !== "external";
  const externalUrl = page.purchase_link?.trim() || null;

  return (
    <article className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[var(--primary)]/30 transition-all duration-300 ease-out active:scale-[0.99]">
      <Link href={`/lp/${page.slug}`} className="block">
        <div className="relative aspect-video bg-[var(--background)] overflow-hidden rounded-t-2xl">
          {page.featured && (
            <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.585 10.8c-.783-.57-.38-1.81.588-1.81h4.915a1 1 0 00.95-.69l1.519-4.674z" />
              </svg>
              Unggulan
            </span>
          )}
          {page.thumbnail_url ? (
            <Image
              src={page.thumbnail_url}
              alt={page.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
              {...(priority ? { priority: true } : { loading: "lazy" as const })}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--accent-subtle)] to-[var(--background)] p-4">
              <span className="text-sm font-medium text-[var(--muted)] text-center line-clamp-2">{page.title}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--card)] via-transparent to-transparent pointer-events-none" />
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {page.category && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[var(--accent-subtle)] text-[var(--muted)]">
              {page.category.name}
            </span>
          )}
        </div>
        <h2 className="font-semibold text-foreground truncate group-hover:text-[var(--primary)] transition-colors mt-1">
          <Link href={`/checkout/${page.slug}`} className="active:opacity-80 transition-opacity duration-150">{page.title}</Link>
        </h2>
        {description && (
          <p className="mt-1.5 text-xs text-[var(--muted)] line-clamp-2">
            {description}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {showAsFree ? (
            <span className="text-sm font-medium text-[var(--primary)]">
              Gratis
            </span>
          ) : (
            <>
              {hasDiscount && price > 0 && (
                <span className="text-sm text-[var(--muted)] line-through">
                  {formatPrice(price)}
                </span>
              )}
              <span className={`text-sm font-medium ${hasDiscount ? "text-[var(--primary)]" : "text-foreground"}`}>
                {formatPrice(displayPrice)}
              </span>
              {hasDiscount && discountPct > 0 && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-[var(--primary)]/15 text-[var(--primary)]">
                  -{discountPct}%
                </span>
              )}
            </>
          )}
        </div>
        {soldCount > 0 || rating ? (
          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted)]">
            {soldCount > 0 && <span>{soldCount} terjual</span>}
            {rating ? (
              <span className="flex items-center gap-1">
                <span className="text-amber-500" aria-hidden>★</span>
                {rating.toFixed(1)}
                {reviewCount > 1 && (
                  <span className="text-[var(--muted)]">({reviewCount} ulasan)</span>
                )}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="mt-2">
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--muted)]">
              Baru
            </span>
          </div>
        )}
        <div className="mt-3 flex gap-2 sm:gap-3">
          <Button
            variant="secondary"
            size="md"
            href={`/lp/${page.slug}`}
            fullWidth
            className="flex-1 text-center"
          >
            Preview
          </Button>
          {showAsFree ? (
            <Button
              size="md"
              href={`/checkout/${page.slug}`}
              fullWidth
              className="flex-1"
            >
              Ambil gratis
            </Button>
          ) : isInternal ? (
            <Button
              size="md"
              href={`/checkout/${page.slug}`}
              fullWidth
              title="Beli sekarang"
              className="flex-1"
            >
              Beli sekarang
            </Button>
          ) : (
            <Button
              size="md"
              href={externalUrl || `/lp/${page.slug}`}
              external={!!externalUrl}
              title={externalUrl ? "Beli sekarang" : "Preview"}
              className="flex-1"
            >
              {externalUrl ? "Beli sekarang" : "Preview"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
