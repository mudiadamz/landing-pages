import type { PublicReview } from "@/lib/actions/reviews";
import { VerifiedBadge, formatReviewMonth } from "@/components/review-bits";
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
              <VerifiedBadge label={t("reviews.verifiedBuyer")} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
