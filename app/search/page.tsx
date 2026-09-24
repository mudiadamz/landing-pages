import type { Metadata } from "next";
import { searchBlog } from "@/lib/actions/blog";
import { searchPath } from "@/lib/blog-path";
import { BlogListingPage } from "@/lib/templates/blog/listing-page";
import { requestLocale } from "@/lib/i18n/request";
import { t } from "@/lib/i18n";

/**
 * Blogger's own search endpoint: /search?q=…
 *
 * Kept at that exact address because it is linked from old posts and sits in
 * people's browser keyword searches. Always noindex: a search results page is
 * not content, and Blogger marked its own the same way.
 */

type Props = { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> };

const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = one((await searchParams).q).trim();
  const locale = await requestLocale();
  return {
    title: t("blog.searchHeading", { query: q }, locale),
    robots: { index: false, follow: false },
  };
}

export default async function SearchRoute({ searchParams }: Props) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const page = Math.max(1, parseInt(one(sp.page), 10) || 1);

  const [locale, listing] = await Promise.all([requestLocale(), searchBlog(q, page)]);

  return (
    <BlogListingPage
      heading={t("blog.searchHeading", { query: q }, locale)}
      subheading={q ? t("blog.resultCount", { count: listing.total }, locale) : null}
      listing={listing}
      hrefFor={(p) => (p === 1 ? searchPath(q) : `${searchPath(q)}&page=${p}`)}
    />
  );
}
