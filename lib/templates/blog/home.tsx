import Link from "next/link";
import type { TemplateProps } from "../registry";
import { BlogHeader, BlogFooter } from "./chrome";
import { PostCard, PostPager } from "./post-card";
import { BlogSidebar } from "./sidebar";
import { siteBrand } from "@/lib/site-brand";
import { t } from "@/lib/i18n";

/**
 * A blog's front page: the most recent posts, newest first, with the two
 * widgets that make an archive navigable beside them.
 *
 * It ignores `pages`, `hero`, `reviews` and the rest of the catalogue props
 * entirely. That is not waste — every template receives the same props by
 * contract, and a blog storefront simply has no products. What it does need
 * arrives in `blog`, fetched in app/page.tsx like everything else, because
 * presentation does not fetch.
 *
 * If `blog` is missing the template still renders: a site switched to this
 * theme before anything was imported gets an honest empty state rather than a
 * crash.
 */
export function BlogHome({ site, locale, user, categories, blog }: TemplateProps) {
  const listing = blog?.listing;
  const posts = listing?.items ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <BlogHeader user={user} brand={siteBrand(site)} categories={categories} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {site.description?.trim() && (
          <p className="mb-8 max-w-2xl text-[0.9375rem] leading-relaxed text-[var(--muted)]">
            {site.description}
          </p>
        )}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="min-w-0">
            {posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-14 text-center">
                <p className="text-[var(--muted)]">{t("blog.empty", undefined, locale)}</p>
              </div>
            ) : (
              <>
                <div className="space-y-7">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} locale={locale} />
                  ))}
                </div>
                <div className="mt-8">
                  <PostPager
                    page={listing!.page}
                    pageCount={listing!.pageCount}
                    hrefFor={(p) => (p === 1 ? "/" : `/?page=${p}`)}
                    locale={locale}
                  />
                </div>
              </>
            )}
          </div>

          <BlogSidebar labels={blog?.labels ?? []} months={blog?.months ?? []} locale={locale} />
        </div>

        {blog?.pages && blog.pages.length > 0 && (
          <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border)] pt-6 text-sm">
            {blog.pages.map((p) => (
              <Link key={p.path} href={p.path} className="text-[var(--muted)] hover:text-[var(--primary)]">
                {p.title}
              </Link>
            ))}
          </nav>
        )}
      </main>

      <BlogFooter />
    </div>
  );
}
