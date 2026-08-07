import Link from "next/link";
import { SortTabs } from "@/components/sort-tabs";
import { PustakaHeader } from "./header";
import { PustakaFooter } from "./footer";
import { ShelfGrid } from "./shelf";
import type { CategoryTemplateProps } from "../registry";

/**
 * One section of the shelf.
 *
 * Same covers as the homepage — a bookshelf that turns into marketplace cards one
 * click deep is worse than either one done consistently. No founder block and no
 * disclaimer wall: this is a browsing page, and the parent brand's credibility
 * pitch belongs on the parent brand's site.
 */
export function PustakaCategory({
  category,
  pages,
  categories,
  sort,
  user,
}: CategoryTemplateProps) {
  return (
    <div data-template="pustaka" className="flex min-h-screen flex-col bg-background text-foreground">
      <PustakaHeader user={user} categories={categories} currentCategorySlug={category.slug} />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--primary)]">
            {pages.length} judul
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-auman)] text-2xl text-foreground sm:text-4xl">
            {category.name}
          </h1>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          {pages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-16 text-center">
              <p className="text-[var(--muted)]">Belum ada judul di rak ini.</p>
              <p className="mt-2 text-sm">
                <Link href="/" className="font-medium text-[var(--primary)] hover:opacity-80">
                  Lihat semua judul
                </Link>
              </p>
            </div>
          ) : (
            <>
              <SortTabs basePath={`/category/${category.slug}`} current={sort} />
              <ShelfGrid pages={pages} />
            </>
          )}
        </section>
      </main>

      <PustakaFooter />
    </div>
  );
}
