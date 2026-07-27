import Link from "next/link";

/**
 * Purchase CTA at the end of the reader. Someone who has just finished the
 * preview is the warmest audience the product gets — the floating buy bar is
 * easy to ignore mid-read, but a card at the end arrives exactly when they're
 * deciding what to do next.
 *
 * When a bundle contains this product it's offered here instead, since "you've
 * finished part one" is the natural moment to sell the whole set.
 */
export type BundleOffer = {
  title: string;
  slug: string;
  itemCount: number;
  note?: string | null;
  priceText: string | null;
  href: string;
};

export function ReaderEndCta({
  title,
  priceText,
  label,
  note,
  href,
  bundle,
}: {
  title: string;
  priceText: string | null;
  label: string;
  note?: string | null;
  href: string;
  bundle?: BundleOffer | null;
}) {
  return (
    <section className="mx-auto w-full max-w-3xl px-5 pb-28 pt-2">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          Selesai membaca
        </p>
        <p className="mt-1.5 font-semibold text-foreground">{title}</p>

        {priceText && (
          <p className="mt-2 text-lg font-bold text-[var(--primary)]">{priceText}</p>
        )}
        {note && <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>}

        <Link
          href={href}
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 active:scale-[0.99]"
        >
          {label}
        </Link>

        {bundle && (
          <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] p-4 text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Hemat dengan paket
            </p>
            <p className="mt-1 font-semibold text-foreground">{bundle.title}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {bundle.note || `Berisi ${bundle.itemCount} produk sekaligus.`}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              {bundle.priceText && (
                <span className="text-base font-bold text-[var(--primary)]">
                  {bundle.priceText}
                </span>
              )}
              <Link
                href={bundle.href}
                className="rounded-lg border border-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--accent-subtle)]"
              >
                Ambil paket lengkap
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
