import { createClient } from "@/lib/supabase/server";
import { getHomepageListing, getCategories, type HomepageSort } from "@/lib/actions/landing-pages";
import { getPublicReviews, getReviewCounts } from "@/lib/actions/reviews";
import { getHero } from "@/lib/actions/site-settings";
import { currentSite } from "@/lib/site-resolve";
import { TemplateHomeView } from "@/lib/templates/chrome";
import { getSiteContent } from "@/lib/actions/site-settings";

type Props = {
  searchParams: Promise<{
    sort?: string | string[];
    q?: string | string[];
    page?: string | string[];
    cat?: string | string[];
  }>;
};

/**
 * Loads the data, then hands it to whichever template this domain runs.
 *
 * The fetching stays HERE rather than inside each template. Per-site catalog
 * filtering, the cache keys and the sort parsing are easy to get subtly wrong, and
 * a future template written for a new niche must not be able to reintroduce a bug
 * like "shows every product on every domain" by fetching its own way.
 */
export default async function Home({ searchParams }: Props) {
  const supabase = await createClient();
  const sp = await searchParams;
  const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";
  const sort: HomepageSort = one(sp.sort) === "popular" ? "popular" : "newest";
  const q = one(sp.q).trim();
  const page = Math.max(1, parseInt(one(sp.page), 10) || 1);
  // Category chips are a toggle set, carried as one comma-separated `cat`.
  // Deduped and capped: the parameter is user-editable and feeds an `in (...)`.
  const categorySlugs = [
    ...new Set(
      (Array.isArray(sp.cat) ? sp.cat.join(",") : sp.cat ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [site, listing, categories, reviews, reviewCounts, hero, content] = await Promise.all([
    currentSite(),
    getHomepageListing({ sort, q, page, categorySlugs }),
    getCategories(),
    getPublicReviews(),
    getReviewCounts(),
    getHero(),
    getSiteContent(),
  ]);

  return (
    <TemplateHomeView
      site={site}
      pages={listing.items}
      listing={listing}
      query={q}
      activeCategories={categorySlugs}
      categories={categories}
      reviews={reviews}
      reviewCounts={reviewCounts}
      hero={hero}
      sort={sort}
      user={user}
      founder={content.founder}
    />
  );
}
