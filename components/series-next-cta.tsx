import Link from "next/link";

/**
 * "Continue to the next part" card, rendered at the end of a preview. Without
 * it a reader who finishes an instalment has no path onward — which is exactly
 * where a serialised release leaks its audience.
 */
export function SeriesNextCta({
  slug,
  title,
  thumbnailUrl,
  price,
  priceDiscount,
  isFree,
}: {
  slug: string;
  title: string;
  thumbnailUrl?: string | null;
  price?: number | null;
  priceDiscount?: number | null;
  isFree?: boolean | null;
}) {
  const display = !isFree && priceDiscount && priceDiscount > 0 ? priceDiscount : price ?? 0;
  const free = isFree || display <= 0;
  const label = free
    ? "Gratis"
    : new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(display);

  return (
    <section className="mx-auto w-full max-w-3xl px-5 pb-28 pt-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          Lanjut baca
        </p>
        <div className="mt-3 flex items-center gap-4 text-left">
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt=""
              className="h-20 w-14 shrink-0 rounded-lg object-cover"
              loading="lazy"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{label}</p>
          </div>
        </div>
        <Link
          href={`/lp/${slug}`}
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 active:scale-[0.99]"
        >
          Baca kelanjutannya →
        </Link>
      </div>
    </section>
  );
}
