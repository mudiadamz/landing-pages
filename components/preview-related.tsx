"use client";

import Image from "next/image";
import Link from "next/link";
import type { RelatedProduct } from "@/lib/actions/landing-pages";

/** Lists are wide, so prefer the landscape thumbnail when one exists. */
function listThumbOf(p: { thumbnail_landscape_url?: string | null; thumbnail_url: string | null }) {
  return p.thumbnail_landscape_url || p.thumbnail_url;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * "Produk terkait" block shown at the very end of a product's preview — after
 * the last page of the PDF/book reader. Products are the ones the seller picked
 * manually in the product form. Renders nothing when the list is empty.
 */
export function PreviewRelated({ items }: { items: RelatedProduct[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--border)]" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Produk terkait
        </h2>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                className="group block overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="relative block aspect-[4/3] w-full overflow-hidden bg-[var(--background)]">
                  {listThumbOf(p) ? (
                    <Image
                      src={listThumbOf(p) as string}
                      alt={p.title}
                      fill
                      sizes="(max-width: 640px) 50vw, 240px"
                      className="object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-[var(--muted)]">
                      {p.title}
                    </span>
                  )}
                </span>
                <span className="block px-3 py-2.5">
                  <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover:text-[var(--primary)]">
                    {p.title}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
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
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
