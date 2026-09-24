import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogArchive } from "@/lib/actions/blog";
import { archivePath, isMonthSegment, isYearSegment } from "@/lib/blog-path";
import { BlogListingPage } from "@/lib/templates/blog/listing-page";
import { monthName } from "@/lib/templates/blog/sidebar";
import { requestLocale } from "@/lib/i18n/request";
import { t } from "@/lib/i18n";

/**
 * A month's archive: /2026/09/
 *
 * Two dynamic segments at the root is the widest route in this app, so the
 * year/month check is what keeps it narrow: anything that is not four digits
 * followed by a two-digit month 404s before a query runs. Static segments still
 * win at level one, so /category/x, /checkout/x and /panel/x are untouched.
 */

type Props = {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year, month } = await params;
  if (!isYearSegment(year) || !isMonthSegment(month)) return {};
  const locale = await requestLocale();
  return {
    title: t("blog.archiveHeading", { period: `${monthName(month, locale)} ${year}` }, locale),
    alternates: { canonical: archivePath(year, month) },
  };
}

export default async function MonthArchiveRoute({ params, searchParams }: Props) {
  const { year, month } = await params;
  if (!isYearSegment(year) || !isMonthSegment(month)) notFound();

  const sp = await searchParams;
  const page = Math.max(1, parseInt(Array.isArray(sp.page) ? sp.page[0] : sp.page ?? "", 10) || 1);
  const [locale, listing] = await Promise.all([
    requestLocale(),
    getBlogArchive(year, month, page),
  ]);

  const period = `${monthName(month, locale)} ${year}`;
  return (
    <BlogListingPage
      heading={t("blog.archiveHeading", { period }, locale)}
      subheading={t("blog.resultCount", { count: listing.total }, locale)}
      listing={listing}
      hrefFor={(p) => (p === 1 ? archivePath(year, month) : `${archivePath(year, month)}?page=${p}`)}
    />
  );
}
