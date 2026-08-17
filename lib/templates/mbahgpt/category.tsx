import Link from "next/link";
import { LandingPageCard } from "@/app/landing-page-card";
import { SortTabs } from "@/components/sort-tabs";
import { siteBrand } from "@/lib/site-brand";
import { translator } from "@/lib/i18n";
import { MbahgptHeader, MbahgptFooter } from "./chrome";
import type { CategoriesTemplateProps, CategoryTemplateProps } from "../registry";

/**
 * Catalogue pages for the chat theme.
 *
 * A chat storefront can still sell things — that is why these exist at all. They
 * are slotted rather than left to fall back to the marketplace ones, because the
 * fallback brings the marketplace's own header and footer with it, and a visitor
 * would jump from a bare chat app into a full storefront in one click.
 *
 * Deliberately plain: a narrow column, the cards, and nothing else. No founder
 * block, no testimonials, no disclaimer wall — the pitch of this storefront is the
 * chat, and a browsing page's job is only to get out of the way.
 */
export function MbahgptCategory({
  site,
  category,
  pages,
  categories,
  reviewCounts,
  sort,
  user,
  locale,
}: CategoryTemplateProps) {
  const t = translator(locale);
  return (
    <div data-template="mbahgpt" className="flex min-h-screen flex-col bg-background text-foreground">
      <MbahgptHeader user={user} brand={siteBrand(site, locale)} categories={categories} currentCategorySlug={category.slug} />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:pt-12">
          <p className="font-mono text-[0.66rem] tracking-[0.12em] text-[var(--muted)] uppercase">
            {pages.length} {t("scope.whatProducts")}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">{category.name}</h1>
        </section>

        <section className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
          {pages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-16 text-center">
              <p className="text-[var(--muted)]">{t("chat.categoryEmpty")}</p>
              <p className="mt-2 text-sm">
                <Link href="/" className="font-medium text-[var(--primary)] hover:opacity-80">
                  {t("chat.backToChat")}
                </Link>
              </p>
            </div>
          ) : (
            <>
              <SortTabs basePath={`/category/${category.slug}`} current={sort} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pages.map((page, i) => (
                  <LandingPageCard key={page.id} page={page} priority={i < 2} reviewCount={reviewCounts[page.id] ?? 0} />
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <MbahgptFooter />
    </div>
  );
}

/** The category index: a list of links, at the width of the rest of the theme. */
export function MbahgptCategories({ site, categories, user, locale }: CategoriesTemplateProps) {
  const t = translator(locale);
  const parents = categories.filter((c) => !c.parent_id);
  return (
    <div data-template="mbahgpt" className="flex min-h-screen flex-col bg-background text-foreground">
      <MbahgptHeader user={user} brand={siteBrand(site, locale)} categories={categories} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-10 sm:pt-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("panel.navCategories")}</h1>
        {parents.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">{t("panel.noCategories")}</p>
        ) : (
          <ul className="mt-6 space-y-2">
            {parents.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/category/${category.slug}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm transition-colors hover:border-[var(--primary)]"
                >
                  <span>{category.name}</span>
                  <span aria-hidden className="text-[var(--muted)]">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <MbahgptFooter />
    </div>
  );
}
