import Link from "next/link";
import Image from "next/image";
import { isUpcoming } from "@/lib/product-status";
import type { LandingPagePublic } from "@/lib/actions/landing-pages";

function formatPrice(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    currencyDisplay: "symbol",
  }).format(value);
}

/**
 * One spine on the shelf: cover, title, price. Nothing else competes.
 *
 * Extracted from the homepage so the category pages show the same object — a
 * bookshelf that turns into marketplace cards one click deep is worse than either
 * one consistently.
 */
export function Shelf({ page, priority }: { page: LandingPagePublic; priority: boolean }) {
  const upcoming = isUpcoming(page.available_at, false);
  const price = page.price ?? 0;
  const discount = page.price_discount ?? 0;
  const hasDiscount = !page.is_free && discount > 0 && discount < price;
  const display = hasDiscount ? discount : price;
  // Portrait thumbnail preferred; the landscape variant exists for marketplace
  // cards and would letterbox badly in a 2:3 frame.
  const cover = page.thumbnail_url || page.thumbnail_landscape_url || "";

  return (
    <li>
      <Link href={`/preview/${page.slug}`} className="group block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
          {cover ? (
            <Image
              src={cover}
              alt={page.title}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              {...(priority ? { priority: true } : { loading: "lazy" as const })}
            />
          ) : (
            <span className="flex h-full items-center justify-center px-3 text-center text-xs text-[var(--muted)]">
              {page.title}
            </span>
          )}
          {upcoming && (
            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[0.625rem] font-medium text-white backdrop-blur">
              Segera
            </span>
          )}
        </div>

        <h2 className="mt-2.5 line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-[var(--primary)]">
          {page.title}
        </h2>
        <p className="mt-1 flex items-baseline gap-1.5 text-sm">
          {page.is_free ? (
            <span className="font-semibold text-[var(--primary)]">Gratis</span>
          ) : (
            <>
              <span className="font-semibold text-foreground">{formatPrice(display)}</span>
              {hasDiscount && (
                <span className="text-xs text-[var(--muted)] line-through">
                  {formatPrice(price)}
                </span>
              )}
            </>
          )}
        </p>
      </Link>
    </li>
  );
}

/** The shelf itself. Same column rhythm on the homepage and category pages. */
export function ShelfGrid({ pages }: { pages: LandingPagePublic[] }) {
  return (
    <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {pages.map((page, i) => (
        <Shelf key={page.id} page={page} priority={i < 4} />
      ))}
    </ul>
  );
}
