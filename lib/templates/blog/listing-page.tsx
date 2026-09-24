import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { currentSite } from "@/lib/site-resolve";
import { requestLocale } from "@/lib/i18n/request";
import { siteBrand } from "@/lib/site-brand";
import { getBlogArchiveMonths, getBlogLabels, type BlogListing } from "@/lib/actions/blog";
import { t } from "@/lib/i18n";
import { BlogHeader, BlogFooter } from "./chrome";
import { PostCard, PostPager } from "./post-card";
import { BlogSidebar } from "./sidebar";

/**
 * The shell every filtered list shares: label, archive month, archive year,
 * search results.
 *
 * Four routes rendering four nearly-identical pages is how three of them end up
 * missing the pager. They differ in a heading and a query; everything else —
 * chrome, sidebar, empty state, paging — is this.
 */
export async function BlogListingPage({
  heading,
  subheading,
  listing,
  hrefFor,
}: {
  heading: string;
  subheading?: string | null;
  listing: BlogListing;
  hrefFor: (page: number) => string;
}) {
  const db = await createClient();
  const [site, locale, labels, months, { data: { user } }] = await Promise.all([
    currentSite(),
    requestLocale(),
    getBlogLabels(),
    getBlogArchiveMonths(),
    db.auth.getUser(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <BlogHeader user={user} brand={siteBrand(site)} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8">
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--primary)]">
            {t("blog.backHome", undefined, locale)}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{heading}</h1>
          {subheading && <p className="mt-1 text-sm text-[var(--muted)]">{subheading}</p>}
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="min-w-0">
            {listing.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-14 text-center">
                <p className="text-[var(--muted)]">{t("blog.searchEmpty", undefined, locale)}</p>
              </div>
            ) : (
              <>
                <div className="space-y-7">
                  {listing.items.map((post) => (
                    <PostCard key={post.id} post={post} locale={locale} />
                  ))}
                </div>
                <div className="mt-8">
                  <PostPager
                    page={listing.page}
                    pageCount={listing.pageCount}
                    hrefFor={hrefFor}
                    locale={locale}
                  />
                </div>
              </>
            )}
          </div>
          <BlogSidebar labels={labels} months={months} locale={locale} />
        </div>
      </main>
      <BlogFooter />
    </div>
  );
}
