import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { siteBrand } from "@/lib/site-brand";
import { CategoryIcon } from "@/lib/category-icons";
import type { CategoriesTemplateProps } from "../registry";

/**
 * Category index for the marketplace template — the previous app/categories body,
 * moved unchanged. Also the FALLBACK for templates that don't slot their own.
 */
export function DefaultCategories({ site, categories, user }: CategoriesTemplateProps) {
  const parents = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);

  return (
    <div data-template="default" className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} brand={siteBrand(site)} categories={categories} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Semua Kategori</h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Jelajahi semua kategori dan sub-kategori produk.
          </p>
        </header>

        {parents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 py-12 px-6 text-center">
            <p className="text-[var(--muted)]">Belum ada kategori.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {parents.map((parent) => {
              const children = childrenOf(parent.id);
              return (
                <section
                  key={parent.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm"
                >
                  <Link
                    href={`/category/${parent.slug}`}
                    className="group flex items-center gap-3"
                  >
                    <span className="cat-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--primary)] transition-colors group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-foreground)]">
                      <CategoryIcon icon={parent.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground group-hover:text-[var(--primary)] transition-colors">
                        {parent.name}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {children.length > 0 ? `${children.length} sub-kategori` : "Lihat produk"}
                      </span>
                    </span>
                  </Link>

                  {children.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {children.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            href={`/category/${sub.slug}`}
                            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--muted)] transition-colors hover:border-[var(--primary)]/40 hover:text-foreground"
                          >
                            <CategoryIcon icon={sub.icon} className="h-3.5 w-3.5 shrink-0" />
                            <span className="whitespace-nowrap">{sub.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
