import Link from "next/link";
import { listingHref } from "./listing-url";
import { translator, type Locale } from "@/lib/i18n";

/**
 * Prev / next for the stack, with the page count between them.
 *
 * Links, not buttons: the page lives in the URL, so a page can be shared,
 * reloaded and reached by the back button. Every other parameter in play (the
 * search term, the sort) is carried across, or paging would silently drop the
 * filter a visitor is looking at.
 *
 * Numbered pages are deliberately absent. On a phone they are a row of
 * three-millimetre targets, and a link-in-bio catalogue is browsed by scrolling,
 * not by jumping to page seven.
 */
export function Pager({
  page,
  pageCount,
  query,
  sort,
  categories,
  locale,
}: {
  page: number;
  pageCount: number;
  query?: string;
  sort?: string;
  categories: string[];
  locale: Locale;
}) {
  const t = translator(locale);
  if (pageCount <= 1) return null;

  const href = (p: number) => listingHref({ categories, query, sort, page: p });

  const box =
    "flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors";

  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label={t("home.pagerLabel")}>
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${box} bg-[var(--card)] text-foreground hover:bg-[var(--accent-subtle)]`}>
          {t("home.pagerPrev")}
        </Link>
      ) : (
        // Held in place rather than removed, so "Berikutnya" does not jump to the
        // left edge on page two.
        <span aria-hidden className={`${box} pointer-events-none opacity-0`}>
          {t("home.pagerPrev")}
        </span>
      )}

      <span className="shrink-0 text-xs text-[var(--muted)]">
        {page} / {pageCount}
      </span>

      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={`${box} bg-[var(--card)] text-foreground hover:bg-[var(--accent-subtle)]`}>
          {t("home.pagerNext")}
        </Link>
      ) : (
        <span aria-hidden className={`${box} pointer-events-none opacity-0`}>
          {t("home.pagerNext")}
        </span>
      )}
    </nav>
  );
}
