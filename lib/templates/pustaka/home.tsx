import Link from "next/link";
import Image from "next/image";
import { SortTabs } from "@/components/sort-tabs";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Testimonials } from "@/components/testimonials";
import { isUpcoming } from "@/lib/product-status";
import type { LandingPagePublic } from "@/lib/actions/landing-pages";
import type { TemplateProps } from "../registry";

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
 * A bookshelf, for storefronts selling things people read.
 *
 * Differs from the marketplace template in three ways that matter for the niche:
 * portrait covers instead of 16:9 preview shots (a book has a cover, not a
 * screenshot), no hero illustration — the shelf IS the hero, so the first screen
 * is stock rather than a pitch — and no founder-credibility block, which is
 * ADM.UIUX branding and would be a stranger's face on someone else's storefront.
 *
 * Header and footer are shared with every template on purpose: navigation,
 * categories and sign-in should not be re-learned per domain.
 */
export function PustakaHome({
  site,
  pages,
  categories,
  reviews,
  sort,
  user,
}: TemplateProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader user={user} categories={categories} />

      <main className="flex-1">
        {/* Editorial masthead. Copy comes from the SITE row, not the hero config —
            a niche storefront usually never opens the Hero screen, and falling back
            to the canonical site's hero copy would put the wrong pitch here. */}
        <section className="w-full border-b border-[var(--border)]">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--primary)]">
              {pages.length} judul tersedia
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-auman)] text-3xl leading-tight text-foreground sm:text-5xl">
              {site.name}
            </h1>
            {site.tagline && (
              <p className="mt-3 max-w-2xl text-base text-[var(--muted)] sm:text-lg">
                {site.tagline}
              </p>
            )}
            <p className="mt-4 text-sm text-[var(--muted)]">
              Preview gratis tanpa daftar · bayar QRIS · langsung baca
            </p>
          </div>
        </section>

        <section id="rak" className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 py-8 sm:px-6 sm:py-12">
          {pages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-16 text-center">
              <p className="text-[var(--muted)]">Rak masih kosong.</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Belum ada judul di kategori yang dipilih untuk domain ini.
              </p>
            </div>
          ) : (
            <>
              <SortTabs basePath="/" current={sort} />
              <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {pages.map((page, i) => (
                  <Shelf key={page.id} page={page} priority={i < 4} />
                ))}
              </ul>
            </>
          )}
        </section>

        <Testimonials reviews={reviews} />
      </main>

      <SiteFooter />
    </div>
  );
}

/** One spine on the shelf: cover, title, price. Nothing else competes. */
function Shelf({ page, priority }: { page: LandingPagePublic; priority: boolean }) {
  const upcoming = isUpcoming(page.available_at, false);
  const price = page.price ?? 0;
  const discount = page.price_discount ?? 0;
  const hasDiscount = !page.is_free && discount > 0 && discount < price;
  const display = hasDiscount ? discount : price;
  // Portrait thumbnail preferred; the landscape variant exists for marketplace
  // cards and would letterbox badly in a 2:3 frame.
  const cover = page.thumbnail_url || page.thumbnail_landscape_url || "";

  return (
    <li>
      <Link href={`/lp/${page.slug}`} className="group block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
          {cover ? (
            <Image
              src={cover}
              alt={page.title}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              {...(priority ? { priority: true } : { loading: "lazy" as const })}
            />
          ) : (
            <span className="flex h-full items-center justify-center px-3 text-center text-xs text-[var(--muted)]">
              {page.title}
            </span>
          )}
          {upcoming && (
            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              Segera
            </span>
          )}
        </div>

        <h2 className="mt-2.5 line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-[var(--primary)]">
          {page.title}
        </h2>
        <p className="mt-1 flex items-baseline gap-1.5 text-sm">
          {page.is_free ? (
            <span className="font-semibold text-[var(--primary)]">Gratis</span>
          ) : (
            <>
              <span className="font-semibold text-foreground">{formatPrice(display)}</span>
              {hasDiscount && (
                <span className="text-xs text-[var(--muted)] line-through">
                  {formatPrice(price)}
                </span>
              )}
            </>
          )}
        </p>
      </Link>
    </li>
  );
}
