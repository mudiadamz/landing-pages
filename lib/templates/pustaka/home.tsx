import { SortTabs } from "@/components/sort-tabs";
import { PustakaHeader } from "./header";
import { PustakaFooter } from "./footer";
import { ShelfGrid } from "./shelf";
import { Testimonials } from "@/components/testimonials";
import { siteBrand } from "@/lib/site-brand";
import type { TemplateProps } from "../registry";

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
    <div data-template="pustaka" className="flex min-h-screen flex-col bg-background text-foreground">
      <PustakaHeader user={user} brand={siteBrand(site)} categories={categories} />

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
              <ShelfGrid pages={pages} />
            </>
          )}
        </section>

        <Testimonials reviews={reviews} />
      </main>

      <PustakaFooter />
    </div>
  );
}
