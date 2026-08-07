import Link from "next/link";
import { ThemeSwitch } from "@/components/theme-switch";
import { currentSite } from "@/lib/site-resolve";
import { PustakaUserMenu } from "./user-menu";
import type { ChromeProps } from "../registry";

/**
 * A bookshop masthead, not a marketplace toolbar.
 *
 * Differences that matter for the niche, rather than restyling for its own sake:
 * the wordmark is the SITE's name (a niche storefront is not ADM.UIUX), categories
 * are plain inline text instead of icon chips in a swipeable rail (a shelf has
 * sections, not app-store filters), and there is no hamburger drawer — a niche
 * catalogue has few enough sections to show them all, and the row wraps on
 * narrow screens instead of hiding behind a menu.
 *
 * A server component: it reads the site row for the wordmark. Only the two bits
 * that genuinely need interactivity (theme, account menu) are client components.
 */
export async function PustakaHeader({
  user,
  categories = [],
  currentCategorySlug = null,
}: ChromeProps) {
  const site = await currentSite();
  // Top-level only. Sub-categories appear on the category page itself, where
  // there is room for them.
  const parents = categories.filter((c) => !c.parent_id);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="min-w-0 shrink-0 font-[family-name:var(--font-auman)] text-lg tracking-tight text-foreground transition-opacity hover:opacity-80"
        >
          {site.name}
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-x-5 gap-y-1 sm:flex sm:flex-wrap">
          {parents.map((c) => {
            const active = currentCategorySlug === c.slug;
            return (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 text-sm transition-colors ${
                  active
                    ? "font-medium text-foreground underline decoration-[var(--primary)] decoration-2 underline-offset-[6px]"
                    : "text-[var(--muted)] hover:text-foreground"
                }`}
              >
                {c.name}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <ThemeSwitch />
          <PustakaUserMenu isLoggedIn={!!user} />
        </div>
      </div>

      {/* On phones the sections move to their own scrollable line, so the wordmark
          keeps the first row to itself. */}
      {parents.length > 0 && (
        <nav className="flex gap-x-4 overflow-x-auto border-t border-[var(--border)] px-4 py-2 [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden">
          {parents.map((c) => {
            const active = currentCategorySlug === c.slug;
            return (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 text-sm ${
                  active ? "font-medium text-foreground" : "text-[var(--muted)]"
                }`}
              >
                {c.name}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
