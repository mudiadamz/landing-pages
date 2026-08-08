import Link from "next/link";
import { LinkbioHeader, LinkbioFooter } from "./chrome";
import { LinkRow } from "./link-row";
import type { CategoryTemplateProps, CategoriesTemplateProps } from "../registry";

/**
 * Both category surfaces for the link-in-bio theme.
 *
 * Slotted rather than left to fall back, because the fallback is the MARKETPLACE
 * version — and that renders marketplace chrome, so a visitor tapping a chip would
 * jump from a bio card to a full storefront header. A theme this visually specific
 * has to own every page it can be navigated to.
 *
 * Same LinkRow as the homepage: one shape, scanned downward.
 */
export function LinkbioCategory({ category, pages, categories, user }: CategoryTemplateProps) {
  return (
    <div
      data-template="linkbio"
      className="flex min-h-screen flex-col bg-background text-foreground"
    >
      <LinkbioHeader user={user} categories={categories} currentCategorySlug={category.slug} />

      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-6 pt-8">
        <div className="text-center">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {category.name}
          </h1>
          <p className="mt-1 text-xs text-[var(--muted)]">{pages.length} tautan</p>
        </div>

        {pages.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center text-sm text-[var(--muted)]">
            Belum ada di sini.{" "}
            <Link href="/" className="font-medium text-[var(--primary)] hover:opacity-80">
              Lihat semua
            </Link>
          </p>
        ) : (
          <ul className="mt-6 space-y-2.5">
            {pages.map((page, i) => (
              <LinkRow key={page.id} page={page} priority={i < 3} />
            ))}
          </ul>
        )}
      </main>

      <LinkbioFooter />
    </div>
  );
}

export function LinkbioCategories({ categories, user }: CategoriesTemplateProps) {
  const parents = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);

  return (
    <div
      data-template="linkbio"
      className="flex min-h-screen flex-col bg-background text-foreground"
    >
      <LinkbioHeader user={user} categories={categories} />

      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-6 pt-8">
        <h1 className="text-center text-lg font-semibold tracking-tight text-foreground">
          Semua tautan
        </h1>

        <ul className="mt-6 space-y-2.5">
          {parents.map((parent) => {
            const kids = childrenOf(parent.id);
            return (
              <li key={parent.id}>
                <Link
                  href={`/category/${parent.slug}`}
                  className="group flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--primary)]/50 hover:shadow-md active:translate-y-0"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {parent.name}
                    </span>
                    {kids.length > 0 && (
                      <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                        {kids.map((k) => k.name).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 text-[var(--muted)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
                  >
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>

      <LinkbioFooter />
    </div>
  );
}
