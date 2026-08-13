import Link from "next/link";
import Image from "next/image";
import { isUpcoming } from "@/lib/product-status";
import type { LandingPagePublic } from "@/lib/actions/landing-pages";
import { t } from "@/lib/i18n";

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
 * One row in the stack: a full-width tap target, thumbnail left, price right.
 *
 * Shaped like a Linktree button rather than a product card on purpose — the whole
 * page is a list of things to tap, so every row is the same height and the same
 * shape, and the eye scans down instead of around. min-height 64px keeps it a
 * comfortable thumb target on a phone, which is where every link-in-bio visit
 * comes from.
 */
export function LinkRow({ page, priority }: { page: LandingPagePublic; priority: boolean }) {
  const upcoming = isUpcoming(page.available_at, false);
  const price = page.price ?? 0;
  const discount = page.price_discount ?? 0;
  const hasDiscount = !page.is_free && discount > 0 && discount < price;
  const display = hasDiscount ? discount : price;
  const thumb = page.thumbnail_url || page.thumbnail_landscape_url || "";
  // Whatever category the product carries. A product is assigned one category,
  // and in a hierarchy that is usually the child — so this is the sub-category
  // when there is one, and the top-level name when the product sits directly
  // under a parent, rather than showing nothing in that case.
  const category = page.category?.name?.trim() || "";

  return (
    <li>
      {/* Checkout, not preview. Checkout is the product page — it carries the
          price, the description, the reviews and the buy button, and it is what
          the sitemap points at. Preview is one tap from there, now on a floating
          bar, so the row no longer has to choose between "look" and "buy". */}
      <Link
        href={`/checkout/${page.slug}`}
        // Flat: no shadow, no lift, no border. The row is a solid tinted block,
        // and pressing it deepens the tint rather than raising it off the page —
        // depth cues are the one thing this look does not use.
        className="group flex min-h-16 items-center gap-3 rounded-2xl bg-[var(--card)] p-2.5 transition-colors duration-150 hover:bg-[var(--accent-subtle)] active:bg-[var(--primary)]/15"
      >
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[var(--background)]">
          {thumb ? (
            <Image
              src={thumb}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
              {...(priority ? { priority: true } : { loading: "lazy" as const })}
            />
          ) : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {page.title}
          </span>
          {/* Price, then what the thing IS. The row already says how much and
              carries a picture; the category is the one word that tells a
              visitor whether it is for them, and the stack has no other place
              to put it. It shrinks before the price does — a clipped category
              still reads, a clipped price misleads. */}
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted)]">
            <span className="shrink-0">
              {upcoming
                ? t("home.upcoming")
                : page.is_free
                  ? t("home.freeRead")
                  : hasDiscount
                    ? `${formatPrice(display)} · dari ${formatPrice(price)}`
                    : formatPrice(display)}
            </span>
            {category && (
              <span className="min-w-0 truncate rounded-full bg-[var(--tag-bg)] px-1.5 py-px text-[11px] font-medium leading-normal text-[var(--tag-fg)]">
                {category}
              </span>
            )}
          </span>
        </span>

        <span
          aria-hidden
          className="shrink-0 pr-1 text-[var(--muted)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
        >
          →
        </span>
      </Link>
    </li>
  );
}
