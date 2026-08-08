import Link from "next/link";
import { LandingPageCard } from "@/app/landing-page-card";
import { SortTabs } from "@/components/sort-tabs";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { siteBrand } from "@/lib/site-brand";
import { FounderCredibility } from "@/components/founder-credibility";
import { Testimonials } from "@/components/testimonials";
import { Disclaimer } from "@/components/disclaimer";
import { HomeHero } from "@/components/home-hero";
import type { TemplateProps } from "../registry";

/**
 * The original storefront, moved here unchanged when templating landed.
 *
 * Kept byte-for-byte equivalent to the previous app/page.tsx body on purpose:
 * admuiux.com runs this, and a templating refactor that quietly restyles the live
 * site would be a regression dressed up as a feature.
 */
export function DefaultHome({
  site,
  pages,
  categories,
  reviews,
  reviewCounts,
  hero,
  sort,
  user,
}: TemplateProps) {
  return (
    <div
      data-template="default"
      className="min-h-screen bg-background text-foreground flex flex-col"
    >
      <SiteHeader user={user} brand={siteBrand(site)} categories={categories} />

      <main className="flex-1 relative">
        <HomeHero hero={hero} templateCount={pages.length} />

        {pages.length === 0 ? (
          <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 py-12 sm:py-16 px-6 sm:px-8 text-center animate-fade-in-up hover:shadow-lg transition-shadow duration-300">
              <p className="text-[var(--muted)]">Belum ada produk digital.</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                <Link href="/signup" className="font-medium text-[var(--primary)] hover:opacity-80 transition-opacity">
                  Daftar
                </Link>{" "}
                untuk membuat dan menjual produk digital pertamamu.
              </p>
            </div>
          </section>
        ) : (
          <section id="templates" className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 scroll-mt-20">
            <SortTabs basePath="/" current={sort} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 landing-grid">
              {pages.map((page, i) => (
                <LandingPageCard
                  key={page.id}
                  page={page}
                  priority={i < 3}
                  reviewCount={reviewCounts[page.id] ?? 0}
                />
              ))}
            </div>
          </section>
        )}

        {pages.length > 0 && (
          <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-4">
            <FounderCredibility templateCount={pages.length} />
          </section>
        )}

        <Testimonials reviews={reviews} />
        <Disclaimer />
      </main>

      <SiteFooter />
    </div>
  );
}
