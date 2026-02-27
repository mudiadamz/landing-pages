"use client";

import Link from "next/link";
import type { LandingPagePublic } from "@/lib/actions/landing-pages";
import { addPurchaseAction } from "@/lib/actions/purchases";

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
  const purchaseUrl = page.purchase_link?.trim() || `/lp/${page.slug}`;

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
        <h2 className="font-semibold text-foreground truncate group-hover:text-[var(--primary)] transition-colors">
          <Link href={`/lp/${page.slug}`}>{page.title}</Link>
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
              <span className="text-sm font-medium text-foreground">
                {formatPrice(displayPrice)}
              </span>
            </>
          )}
        </div>
        <div className="mt-3 flex gap-2 sm:gap-3">
          <Link
            href={`/lp/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
                className="flex-1 text-center px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--background)] transition-colors"
          >
            Lihat
          </Link>
          {showAsFree ? (
            isLoggedIn ? (
              <form action={addPurchaseAction} className="flex-1" target="_blank">
                <input type="hidden" name="landing_page_id" value={page.id} />
                <button
                  type="submit"
                  className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity"
                >
                  Ambil gratis
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center px-3 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity"
              >
                Ambil gratis (masuk)
              </Link>
            )
          ) : (
            <a
              href={purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center px-3 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity"
            >
              {page.purchase_link ? "Beli" : "Lihat"}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
