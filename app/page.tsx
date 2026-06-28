import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLandingPagesForHomepage, getCategories } from "@/lib/actions/landing-pages";
import { getPublicReviews, getReviewCounts } from "@/lib/actions/reviews";
import { LandingPageCard } from "./landing-page-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FounderCredibility } from "@/components/founder-credibility";
import { Testimonials } from "@/components/testimonials";
import { Disclaimer } from "@/components/disclaimer";
import { HomeHero } from "@/components/home-hero";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [pages, categories, reviews, reviewCounts] = await Promise.all([
    getLandingPagesForHomepage(),
    getCategories(),
    getPublicReviews(),
    getReviewCounts(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} categories={categories} />

      <main className="flex-1 relative">
        <HomeHero templateCount={pages.length} />

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
