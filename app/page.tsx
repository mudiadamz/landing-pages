import { createClient } from "@/lib/supabase/server";
import { getLandingPagesForHomepage, getCategories, type HomepageSort } from "@/lib/actions/landing-pages";
import { getPublicReviews, getReviewCounts } from "@/lib/actions/reviews";
import { getHero } from "@/lib/actions/site-settings";
import { currentSite } from "@/lib/site-resolve";
import { TemplateHomeView } from "@/lib/templates/chrome";
import { getSiteContent } from "@/lib/actions/site-settings";

type Props = { searchParams: Promise<{ sort?: string | string[] }> };

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
  const sortParam = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sort: HomepageSort = sortParam === "popular" ? "popular" : "newest";
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [site, pages, categories, reviews, reviewCounts, hero, content] = await Promise.all([
    currentSite(),
    getLandingPagesForHomepage(null, sort),
    getCategories(),
    getPublicReviews(),
    getReviewCounts(),
    getHero(),
    getSiteContent(),
  ]);

  return (
    <TemplateHomeView
      site={site}
      pages={pages}
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
