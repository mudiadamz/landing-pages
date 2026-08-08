import Image from "next/image";
import Link from "next/link";
import { EndCtaLink } from "./end-cta-link";
import { ExcerptGate } from "./excerpt-gate";

/**
 * Everything that follows the last page of a preview, as one panel.
 *
 * This used to be two bordered cards stacked on each other — a buy card and a
 * "next part" card — which read as two competing offers. Now it's a single
 * quiet-to-loud sequence: an end marker, then where to go next, then the
 * purchase, so the strongest thing on screen is the last thing read.
 *
 * `gated` inverts that sequence. A reader who finished the book can be left
 * alone; a reader stopped by a paywall is mid-story and needs the answer to
 * "how do I keep reading" immediately, not after two rows of other products.
 * So the gate and the purchase come first, and everything else demotes to
 * "kalau mau yang lain" underneath.
 */
export type NextItem = {
  slug: string;
  title: string;
  thumbnailUrl?: string | null;
  priceText: string;
};

export type BundleOffer = {
  title: string;
  slug: string;
  itemCount: number;
  note?: string | null;
  priceText: string | null;
};

function ItemRow({ item, label }: { item: NextItem; label: string }) {
  return (
    <Link
      href={`/preview/${item.slug}`}
      className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 transition-colors hover:border-[var(--primary)]/40"
    >
      {item.thumbnailUrl ? (
        <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--background)]">
          <Image src={item.thumbnailUrl} alt="" fill sizes="48px" className="object-cover" />
        </span>
      ) : (
        <span className="h-16 w-12 shrink-0 rounded-lg bg-[var(--background)]" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
          {label}
        </span>
        <span className="mt-0.5 block truncate font-semibold text-foreground">{item.title}</span>
        <span className="mt-0.5 block text-sm text-[var(--muted)]">{item.priceText}</span>
      </span>
      <span
        aria-hidden
        className="shrink-0 text-lg text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
      >
        →
      </span>
    </Link>
  );
}

export function ReaderEndPanel({
  next,
  related,
  bundle,
  buyHref,
  buyLabel,
  priceText,
  note,
  external,
  slug,
  ctaAction,
  gated,
}: {
  /** The next instalment, when this product is part of a series. */
  next?: NextItem | null;
  /** Other products, shown only when there's no next part to point at. */
  related?: NextItem[];
  bundle?: BundleOffer | null;
  buyHref: string;
  buyLabel: string;
  priceText: string | null;
  note?: string | null;
  /** External purchase link — opens in a new tab. */
  external?: boolean;
  /** Slug + action name for the CTA click event (see EndCtaLink). */
  slug?: string;
  ctaAction?: string;
  /** The preview stopped early because the rest is paid. */
  gated?: boolean;
}) {
  // One continuation block, not three. A next part always wins; otherwise show
  // a couple of related titles.
  const others = next ? [] : (related ?? []).slice(0, 2);
  const hasContinuation = !!next || others.length > 0;

  return (
    <section className="mx-auto w-full max-w-3xl px-5 pb-28 pt-6">
      {gated ? (
        <>
          <ExcerptGate />

          {/* Straight from the gate to the purchase — nothing in between. */}
          <div className="mt-4">
            <EndCtaLink
              href={buyHref}
              label={buyLabel}
              priceText={priceText}
              external={external}
              slug={slug}
              ctaAction={ctaAction}
            />
            {note && <p className="mt-2 text-center text-xs text-[var(--muted)]">{note}</p>}
          </div>

          {bundle && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-[var(--accent-subtle)] px-4 py-3">
              <span className="text-sm font-medium text-foreground">{bundle.title}</span>
              <span className="text-xs text-[var(--muted)]">
                {bundle.note || `${bundle.itemCount} produk sekaligus`}
              </span>
              <Link
                href={`/checkout/${bundle.slug}`}
                className="ml-auto shrink-0 text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                {bundle.priceText ? `Paket ${bundle.priceText} →` : "Lihat paket →"}
              </Link>
            </div>
          )}

          {hasContinuation && (
            <div className="mt-8 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                Kalau mau yang lain
              </p>
              {next && <ItemRow item={next} label="Lanjut baca" />}
              {others.map((o) => (
                <ItemRow key={o.slug} item={o} label="Buku lain" />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* End marker — quiet, just enough to close the reading. */}
          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs tracking-[0.3em] text-[var(--muted)]">• • •</span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          {hasContinuation && (
            <div className="mt-6 space-y-2">
              {next && <ItemRow item={next} label="Lanjut baca" />}
              {others.map((o) => (
                <ItemRow key={o.slug} item={o} label="Buku lain" />
              ))}
            </div>
          )}

          {bundle && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-[var(--accent-subtle)] px-4 py-3">
              <span className="text-sm font-medium text-foreground">{bundle.title}</span>
              <span className="text-xs text-[var(--muted)]">
                {bundle.note || `${bundle.itemCount} produk sekaligus`}
              </span>
              <Link
                href={`/checkout/${bundle.slug}`}
                className="ml-auto shrink-0 text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                {bundle.priceText ? `Paket ${bundle.priceText} →` : "Lihat paket →"}
              </Link>
            </div>
          )}

          {/* The purchase sits last and is the only loud thing here — and, since
              the floating bar was removed, the only purchase prompt on the page. */}
          <div className="mt-6">
            <EndCtaLink
              href={buyHref}
              label={buyLabel}
              priceText={priceText}
              external={external}
              slug={slug}
              ctaAction={ctaAction}
            />
            {note && <p className="mt-2 text-center text-xs text-[var(--muted)]">{note}</p>}
          </div>
        </>
      )}
    </section>
  );
}
