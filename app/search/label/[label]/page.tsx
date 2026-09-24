import type { Metadata } from "next";
import { getBlogByLabel } from "@/lib/actions/blog";
import { labelPath } from "@/lib/blog-path";
import { BlogListingPage } from "@/lib/templates/blog/listing-page";
import { requestLocale } from "@/lib/i18n/request";
import { t } from "@/lib/i18n";
import { slugFromTitle } from "@/lib/slug";

/**
 * Posts under one label: /search/label/Cloud%20Computing
 *
 * Blogger addresses a label by its DISPLAY NAME, percent-encoded — not by a
 * slug. The stored slug is what this app matches on, so the incoming name is
 * slugified here rather than stored twice: "Cloud Computing", "cloud%20computing"
 * and "Cloud  Computing" all have to reach the same list, because all three
 * exist in ten years of other people's links.
 */

type Props = {
  params: Promise<{ label: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { label } = await params;
  const name = decodeURIComponent(label);
  const locale = await requestLocale();
  return {
    title: t("blog.labelHeading", { label: name }, locale),
    alternates: { canonical: labelPath(name) },
    // A label page is a filtered view of posts that are all indexed on their
    // own. Blogger marked these noindex for the same reason.
    robots: { index: false, follow: true },
  };
}

export default async function LabelRoute({ params, searchParams }: Props) {
  const { label } = await params;
  const name = decodeURIComponent(label);
  const sp = await searchParams;
  const page = Math.max(1, parseInt(Array.isArray(sp.page) ? sp.page[0] : sp.page ?? "", 10) || 1);

  const [locale, listing] = await Promise.all([
    requestLocale(),
    getBlogByLabel(slugFromTitle(name), page),
  ]);

  return (
    <BlogListingPage
      heading={t("blog.labelHeading", { label: name }, locale)}
      subheading={t("blog.resultCount", { count: listing.total }, locale)}
      listing={listing}
      hrefFor={(p) => (p === 1 ? labelPath(name) : `${labelPath(name)}?page=${p}`)}
    />
  );
}
