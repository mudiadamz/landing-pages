"use client";

import Link from "next/link";
import type { LandingPagePublic } from "@/lib/actions/landing-pages";
import { addPurchaseAction } from "@/lib/actions/purchases";

function BuyNowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

type Props = { page: LandingPagePublic; isLoggedIn?: boolean };

function formatPrice(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    currencyDisplay: "symbol",
  }).format(value);
}

export function LandingPageCard({ page, isLoggedIn }: Props) {
  const isFree = page.is_free === true;
  const price = page.price ?? 0;
  const priceDiscount = page.price_discount ?? 0;
  const hasDiscount = !isFree && priceDiscount > 0;
  const displayPrice = hasDiscount ? priceDiscount : price;
  const showAsFree = isFree || displayPrice <= 0;
  const isInternal = page.purchase_type !== "external";
  const externalUrl = page.purchase_link?.trim() || null;

  return (
    <article className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[var(--primary)]/30 transition-all duration-300 ease-out active:scale-[0.99]">
      <Link href={`/lp/${page.slug}`} className="block">
        <div className="relative aspect-video bg-[var(--background)] overflow-hidden rounded-t-2xl">
          {page.thumbnail_url ? (
            <img
              src={page.thumbnail_url}
              alt={page.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <iframe
              srcDoc={page.html_content}
              title={page.title}
              className="absolute inset-0 w-full h-full border-0 pointer-events-none"
              sandbox="allow-scripts allow-same-origin allow-modals"
            />
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
          <Link href={`/lp/${page.slug}`} className="active:opacity-80 transition-opacity duration-150">{page.title}</Link>
        </h2>
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
              {hasDiscount && price > 0 && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[var(--primary)]/15 text-[var(--primary)]">
                  Diskon
                </span>
              )}
            </>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted)]">
          <span>{page.sold_count ?? 0} terjual</span>
          {page.rating != null && page.rating > 0 ? (
            <span className="flex items-center gap-1">
              <span className="text-amber-500" aria-hidden>★</span>
              {Number(page.rating).toFixed(1)}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex gap-2 sm:gap-3">
          <Link
            href={`/lp/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--background)] active:scale-[0.98] active:opacity-90 transition-all duration-150"
          >
            Lihat
          </Link>
          {showAsFree ? (
            isLoggedIn ? (
              <form action={addPurchaseAction} className="flex-1" target="_blank">
                <input type="hidden" name="landing_page_id" value={page.id} />
                <button
                  type="submit"
                  className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 active:scale-[0.98] active:opacity-90 transition-all duration-150"
                >
                  Ambil gratis
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center px-3 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 active:scale-[0.98] active:opacity-90 transition-all duration-150"
              >
                Ambil gratis (masuk)
              </Link>
            )
          ) : isInternal ? (
            <Link
              href={`/checkout/${page.slug}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 active:scale-[0.98] active:opacity-90 transition-all duration-150"
              title="Beli sekarang"
            >
              <BuyNowIcon className="w-4 h-4" />
              Beli sekarang
            </Link>
          ) : (
            <a
              href={externalUrl || `/lp/${page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 active:scale-[0.98] active:opacity-90 transition-all duration-150"
              title={externalUrl ? "Beli sekarang" : "Lihat"}
            >
              <BuyNowIcon className="w-4 h-4" />
              {externalUrl ? "Beli sekarang" : "Lihat"}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
