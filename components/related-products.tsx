import Image from "next/image";
import Link from "next/link";
import type { LandingPageCategory, RelatedProduct } from "@/lib/actions/landing-pages";

function formatPrice(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Compact list of related products (same parent category), plus a link to the
 * full category page. Rendered at the bottom of the checkout page. Renders
 * nothing when there are no siblings to show.
 */
export function RelatedProducts({
  items,
  parent,
}: {
  items: RelatedProduct[];
  parent: LandingPageCategory | null;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          Produk terkait
          {parent && <span className="font-normal text-[var(--muted)]"> · {parent.name}</span>}
        </h2>
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {items.map((p) => {
          const isFree = p.is_free === true;
          const price = p.price ?? 0;
          const discount = p.price_discount ?? 0;
          const hasDiscount = !isFree && discount > 0;
          const display = hasDiscount ? discount : price;
          const showAsFree = isFree || display <= 0;
          return (
            <li key={p.id}>
              <Link
                href={`/checkout/${p.slug}`}
                className="group flex items-center gap-3 py-3 transition-colors first:pt-0 last:pb-0"
              >
                <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
                  {p.thumbnail_url ? (
                    <Image
                      src={p.thumbnail_url}
                      alt={p.title}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-[var(--muted)]">
                      {p.title}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover:text-[var(--primary)]">
                    {p.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    {showAsFree ? (
                      <span className="text-sm font-semibold text-[var(--primary)]">Gratis</span>
                    ) : (
                      <>
                        {hasDiscount && price > 0 && (
                          <span className="text-xs text-[var(--muted)] line-through">
                            {formatPrice(price)}
                          </span>
                        )}
                        <span className="text-sm font-semibold text-foreground">
                          {formatPrice(display)}
                        </span>
                      </>
                    )}
                  </span>
                </span>
                <svg
                  className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>

      {parent && (
        <Link
          href={`/category/${parent.slug}`}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-[var(--background)]"
        >
          Produk lainnya di {parent.name}
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </section>
  );
}
