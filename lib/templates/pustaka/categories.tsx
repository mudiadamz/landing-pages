import Link from "next/link";
import { PustakaHeader } from "./header";
import { PustakaFooter } from "./footer";
import { siteBrand } from "@/lib/site-brand";
import type { CategoriesTemplateProps } from "../registry";

/**
 * The shelf's sections, as a contents page rather than a tile grid.
 *
 * A bookshop lists its sections as words — icon tiles are app-store furniture and
 * would put the marketplace's visual language back on a storefront that spent the
 * homepage getting rid of it.
 */
export function PustakaCategories({ site, categories, user }: CategoriesTemplateProps) {
  const parents = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);

  return (
    <div data-template="pustaka" className="flex min-h-screen flex-col bg-background text-foreground">
      <PustakaHeader user={user} brand={siteBrand(site)} categories={categories} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--primary)]">
          {parents.length} bagian
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-auman)] text-2xl text-foreground sm:text-4xl">
          Isi rak
        </h1>

        {parents.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center text-[var(--muted)]">
            Belum ada bagian.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-[var(--border)]">
            {parents.map((parent) => {
              const children = childrenOf(parent.id);
              return (
                <li key={parent.id} className="py-5">
                  <Link
                    href={`/category/${parent.slug}`}
                    className="group flex items-baseline justify-between gap-4"
                  >
                    <span className="text-lg text-foreground transition-colors group-hover:text-[var(--primary)]">
                      {parent.name}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {children.length > 0 ? `${children.length} sub` : "lihat"}
                    </span>
                  </Link>

                  {children.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {children.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            href={`/category/${sub.slug}`}
                            className="text-sm text-[var(--muted)] transition-colors hover:text-foreground"
                          >
                            {sub.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <PustakaFooter />
    </div>
  );
}
