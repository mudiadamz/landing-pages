import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getLandingPagesForHomepage, getCategories, type HomepageSort } from "@/lib/actions/landing-pages";
import { getPublicReviews, getReviewCounts } from "@/lib/actions/reviews";
import { LandingPageCard } from "@/app/landing-page-card";
import { SortTabs } from "@/components/sort-tabs";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FounderCredibility } from "@/components/founder-credibility";
import { Testimonials } from "@/components/testimonials";
import { Disclaimer } from "@/components/disclaimer";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) return { title: "Kategori tidak ditemukan" };
  return { title: `${cat.name} — ADM.UIUX` };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const sortParam = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sort: HomepageSort = sortParam === "popular" ? "popular" : "newest";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [pages, categories, reviews, reviewCounts] = await Promise.all([
    getLandingPagesForHomepage(slug, sort),
    getCategories(),
    getPublicReviews(),
    getReviewCounts(),
  ]);

  const cat = categories.find((c) => c.slug === slug);
  if (!cat) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} categories={categories} currentCategorySlug={slug} />

      <main className="flex-1 relative">
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">{cat.name}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{pages.length} produk</p>
        </section>

        {pages.length === 0 ? (
          <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 py-12 sm:py-16 px-6 sm:px-8 text-center animate-fade-in-up hover:shadow-lg transition-shadow duration-300">
              <p className="text-[var(--muted)]">Belum ada landing page di kategori ini.</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                <Link href="/" className="font-medium text-[var(--primary)] hover:opacity-80 transition-opacity">
                  Lihat semua
                </Link>
              </p>
            </div>
          </section>
        ) : (
          <section id="templates" className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 scroll-mt-20">
            <SortTabs basePath={`/category/${slug}`} current={sort} />
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
