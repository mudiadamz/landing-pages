import { cache } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getLandingPageForCheckout } from "@/lib/actions/landing-pages";
import { getPublicReviews, getReviewCount } from "@/lib/actions/reviews";
import { VerifiedReviews } from "@/components/verified-reviews";
import { FounderCredibility } from "@/components/founder-credibility";
import { JsonLd } from "@/components/json-ld";
import { SITE_URL, buildMetaDescription } from "@/lib/seo";
import { RichText } from "@/components/rich-text";
import { CheckoutForm } from "./checkout-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { GuaranteeBadge, PaymentMethodsRow } from "@/components/trust-badges";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ h?: string | string[] }>;
};

/** Dedupe the DB read across generateMetadata + the page render. */
const getCheckoutPage = cache((slug: string) => getLandingPageForCheckout(slug));

function formatPrice(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    currencyDisplay: "symbol",
  }).format(value);
}

/**
 * Echo the ad's headline (?h=) above the title for ad->landing message match.
 * Plain text only (React escapes it), angle brackets stripped as defense in
 * depth, whitespace collapsed, and clamped to 80 chars so a crafted URL can't
 * inject long/abusive copy. The canonical URL omits the query, so ?h= variants
 * are not indexed separately.
 */
function sanitizeAdHeadline(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const cleaned = v
    .replace(/</g, " ")
    .replace(/>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3) return null;
  return cleaned.length > 80 ? `${cleaned.slice(0, 79).trimEnd()}…` : cleaned;
}

const includes = [
  { label: "File HTML/CSS/JS bersih & responsif", icon: CodeIcon },
  { label: "Siap deploy — langsung pakai", icon: RocketIcon },
  { label: "Akses download selamanya di panel", icon: InfinityIcon },
  { label: "File ZIP langsung download", icon: DownloadIcon },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCheckoutPage(slug);
  if (!page) return { title: "Checkout" };
  const description = buildMetaDescription(
    page.long_description,
    `${page.title} — produk digital siap pakai. Preview gratis, beli, download, pakai.`,
  );
  const url = `/checkout/${slug}`;
  const images = page.thumbnail_url ? [page.thumbnail_url] : undefined;
  return {
    title: `Checkout — ${page.title}`,
    description,
    alternates: { canonical: url },
    openGraph: { title: page.title, description, url, images, type: "website" },
    twitter: { card: "summary_large_image", title: page.title, description, images },
  };
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [supabase, page, sp] = await Promise.all([
    createClient(),
    getCheckoutPage(slug),
    searchParams,
  ]);
  if (!page) notFound();
  const adHeadline = sanitizeAdHeadline(sp.h);
  const [{ data: { user } }, reviews, reviewCount] = await Promise.all([
    supabase.auth.getUser(),
    getPublicReviews(page.id, 5),
    getReviewCount(page.id),
  ]);

  const isFree = page.is_free === true;
  const price = page.price ?? 0;
  const priceDiscount = page.price_discount ?? 0;
  const hasDiscount = !isFree && priceDiscount > 0;
  const displayPrice = hasDiscount ? priceDiscount : price;
  const showAsFree = isFree || displayPrice <= 0;
  const discountPct = hasDiscount && price > 0 ? Math.round(((price - priceDiscount) / price) * 100) : 0;
  const soldCount = page.sold_count ?? 0;
  const rating = page.rating != null && page.rating > 0 ? Number(page.rating) : null;

  const canonicalUrl = `${SITE_URL}/checkout/${page.slug}`;
  const metaDescription = buildMetaDescription(
    page.long_description,
    `${page.title} — produk digital siap pakai.`,
  );
  // No aggregateRating yet — emitting one without a review count reads as
  // manufactured and trips structured-data validators (see audit B6).
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: page.title,
    description: metaDescription,
    ...(page.thumbnail_url ? { image: [page.thumbnail_url] } : {}),
    url: canonicalUrl,
    brand: { "@type": "Brand", name: "ADM.UIUX" },
    offers: {
      "@type": "Offer",
      price: showAsFree ? 0 : displayPrice,
      priceCurrency: "IDR",
      availability: "https://schema.org/InStock",
      url: canonicalUrl,
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: page.title, item: canonicalUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <SiteHeader user={user} />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link
          href="/"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors mb-6 inline-block"
        >
          ← Kembali ke beranda
        </Link>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
          {/* Discount banner */}
          {hasDiscount && discountPct > 0 && (
            <div className="bg-[var(--primary)] text-[var(--primary-foreground)] text-center py-2 px-4 text-sm font-medium">
              Hemat {discountPct}% dari harga normal
            </div>
          )}

          {/* Thumbnail */}
          <div className="relative aspect-video bg-[var(--background)]">
            {page.thumbnail_url ? (
              <Image
                src={page.thumbnail_url}
                alt={page.title}
                fill
                sizes="(max-width: 640px) 100vw, 576px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--muted)] text-sm">
                {page.title}
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Title (with optional ad-headline echo for ad->landing message match) */}
            <div className="space-y-1">
              {adHeadline && (
                <p className="text-sm font-medium text-[var(--primary)]">{adHeadline}</p>
              )}
              <h1 className="text-xl font-semibold text-foreground">{page.title}</h1>
            </div>

            {/* Price */}
            <div className="flex items-center gap-2 flex-wrap">
              {showAsFree ? (
                <span className="text-2xl font-bold text-[var(--primary)]">Gratis</span>
              ) : (
                <>
                  {hasDiscount && price > 0 && (
                    <span className="text-base text-[var(--muted)] line-through">
                      {formatPrice(price)}
                    </span>
                  )}
                  <span className="text-2xl font-bold text-foreground">
                    {formatPrice(displayPrice)}
                  </span>
                  {hasDiscount && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[var(--primary)]/15 text-[var(--primary)]">
                      -{discountPct}%
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Social proof */}
            {(soldCount > 0 || rating) && (
              <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
                {soldCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    {soldCount} terjual
                  </span>
                )}
                {rating && (
                  <span className="flex items-center gap-1">
                    <span className="text-amber-500">★</span>
                    {rating.toFixed(1)}
                    {reviewCount > 1 && <span>({reviewCount} ulasan)</span>}
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            {page.long_description && (
              <RichText text={page.long_description} className="text-sm text-[var(--muted)]" />
            )}

            {/* Verified buyer reviews */}
            <VerifiedReviews reviews={reviews} />

            {/* What you get */}
            <div className="border-t border-[var(--border)] pt-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Yang kamu dapat</h2>
              <ul className="space-y-2.5">
                {includes.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-[var(--muted)]">
                    <item.icon className="w-4 h-4 shrink-0 text-[var(--primary)]" />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA — guarantee surfaced at the hesitation point, payment methods below */}
            <div className="border-t border-[var(--border)] pt-5 space-y-3">
              {!showAsFree && <GuaranteeBadge />}
              {/* Live demo — the proof. Let cold traffic touch the real, public,
                  no-login product right before the purchase wall. */}
              <Button
                variant="secondary"
                size="lg"
                href={`/lp/${page.slug}`}
                fullWidth
                leftIcon={<EyeIcon className="w-5 h-5" />}
              >
                Preview Product
              </Button>
              <CheckoutForm
                page={page}
                isLoggedIn={!!user}
                showAsFree={showAsFree}
                purchaseLink={page.purchase_link?.trim() || null}
              />
              {!showAsFree && <PaymentMethodsRow className="pt-1" />}
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <svg className="w-4 h-4 shrink-0 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Pembayaran aman
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <svg className="w-4 h-4 shrink-0 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Akses file selamanya
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <svg className="w-4 h-4 shrink-0 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download langsung
              </div>
            </div>

            {/* Maker proof */}
            <FounderCredibility />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}
function RocketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
function InfinityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9" />
    </svg>
  );
}
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
