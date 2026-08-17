import { notFound } from "next/navigation";
import { translator } from "@/lib/i18n";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getLandingPagesForHomepage, getCategories, type HomepageSort } from "@/lib/actions/landing-pages";
import { getPublicReviews, getReviewCounts } from "@/lib/actions/reviews";
import { currentSite } from "@/lib/site-resolve";
import { TemplateCategoryView } from "@/lib/templates/chrome";
import { requestLocale } from "@/lib/i18n/request";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) return { title: translator(await requestLocale())("home.categoryNotFound") };
  // Brand comes from the layout title template, per domain.
  return { title: cat.name };
}

/**
 * Loads the data, then hands it to this domain's template — same split as
 * app/page.tsx and for the same reason: per-site catalog filtering and the cache
 * keys stay in one place, where a future template can't fetch around them.
 */
export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const sortParam = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sort: HomepageSort = sortParam === "popular" ? "popular" : "newest";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [site, pages, categories, reviews, reviewCounts, locale] = await Promise.all([
    currentSite(),
    getLandingPagesForHomepage(slug, sort),
    getCategories(),
    getPublicReviews(),
    getReviewCounts(),
    requestLocale(),
  ]);

  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  return (
    <TemplateCategoryView
      site={site}
      locale={locale}
      category={category}
      pages={pages}
      categories={categories}
      reviews={reviews}
      reviewCounts={reviewCounts}
      sort={sort}
      user={user}
    />
  );
}
