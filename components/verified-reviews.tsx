import type { PublicReview } from "@/lib/actions/reviews";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

async function Stars({ rating }: { rating: number }) {
  const t = translator(await requestLocale());
  return (
    <span className="inline-flex items-center" aria-label={t("panel.starsOutOfFive", { rating })}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={i < rating ? "text-amber-500" : "text-[var(--border)]"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export async function VerifiedBadge() {
  const t = translator(await requestLocale());
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {t("reviews.verifiedBuyer")}
    </span>
  );
}

export function formatReviewMonth(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

/**
 * Server-rendered list of verified-buyer reviews. Renders nothing when empty,
 * so callers can drop it in unconditionally.
 */
export async function VerifiedReviews({
  reviews,
  title,
}: {
  reviews: PublicReview[];
  /** Defaults to "Ulasan pembeli" in the caller's locale. */
  title?: string;
}) {
  const t = translator(await requestLocale());
  const heading = title ?? t("reviews.buyerReviews");
  if (!reviews.length) return null;
  return (
    <section className="border-t border-[var(--border)] pt-5">
      <h2 className="text-sm font-semibold text-foreground mb-3">{heading}</h2>
      <ul className="space-y-4">
        {reviews.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <Stars rating={r.rating} />
              <span className="text-xs text-[var(--muted)]">
                {formatReviewMonth(r.created_at)}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)] leading-relaxed whitespace-pre-wrap">
              {r.review_text}
            </p>
            <div className="mt-2">
              <VerifiedBadge />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
