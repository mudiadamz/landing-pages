"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { PublicReview } from "@/lib/actions/reviews";
import { VerifiedBadge, formatReviewMonth } from "@/components/verified-reviews";
import { Button } from "@/components/ui/button";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center text-base" aria-label={`${rating} dari 5 bintang`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden className={i < rating ? "text-amber-500" : "text-[var(--border)]"}>
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * Homepage social proof — real, purchase-gated reviews only. Renders nothing
 * when there are no reviews yet (honest > fabricated).
 */
export function Testimonials({ reviews }: { reviews: PublicReview[] }) {
  const [active, setActive] = useState(0);

  const goNext = useCallback(() => {
    setActive((prev) => (prev + 1) % reviews.length);
  }, [reviews.length]);

  const goPrev = useCallback(() => {
    setActive((prev) => (prev - 1 + reviews.length) % reviews.length);
  }, [reviews.length]);

  if (!reviews.length) return null;

  const current = Math.min(active, reviews.length - 1);

  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-t border-[var(--border)] testimonials-section">
      <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-8 sm:mb-10">
        Kata pembeli
      </h2>
      <div className="relative">
        <div className="overflow-hidden">
          {reviews.map((t, i) => (
            <blockquote
              key={t.id}
              className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-8 text-sm sm:text-base text-[var(--muted)] leading-relaxed transition-all duration-300 ease-out ${
                i === current ? "opacity-100 block" : "opacity-0 hidden"
              }`}
              style={i === current ? { animation: "fadeIn 0.35s ease-out" } : undefined}
            >
              <Stars rating={t.rating} />
              <p className="mb-5 sm:mb-6 mt-3 whitespace-pre-wrap">&ldquo;{t.review_text}&rdquo;</p>
              <footer className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <VerifiedBadge />
                <span className="text-[var(--muted)]"> · {formatReviewMonth(t.created_at)}</span>
                {/* Only rendered when the product is still published — a hidden
                    page 404s for everyone but its owner. */}
                {t.product && (
                  <>
                    <span className="text-[var(--muted)]" aria-hidden>
                      ·
                    </span>
                    <Link
                      href={`/lp/${t.product.slug}`}
                      className="font-medium text-[var(--primary)] hover:underline"
                    >
                      {t.product.title}
                    </Link>
                  </>
                )}
              </footer>
            </blockquote>
          ))}
        </div>
        {reviews.length > 1 && (
          <div className="flex items-center justify-between mt-6 sm:mt-8">
            <div className="flex gap-2">
              {reviews.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`Ulasan ${i + 1}`}
                  onClick={() => setActive(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === current ? "bg-[var(--primary)] scale-125" : "bg-[var(--border)] hover:bg-[var(--muted)] hover:scale-110"
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={goPrev}
                aria-label="Sebelumnya"
                className="text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)] hover:scale-105 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={goNext}
                aria-label="Selanjutnya"
                className="text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)] hover:scale-105 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
