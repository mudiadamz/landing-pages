"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Floating bar on checkout: preview on the left, pay on the right.
 *
 * The page's real CTA block sits well below the fold on a phone — under the
 * description, the includes list and the guarantee — so the two things a visitor
 * came to do were both a scroll away. This keeps them at the thumb.
 *
 * The pay button does NOT re-implement payment. CheckoutForm owns that flow
 * (login state, free vs paid, Duitku, external links, calendar), and a second
 * copy would be a second thing to keep correct and a second way to double-fire
 * an order. This scrolls to it and focuses it instead, so there is exactly one
 * payment control on the page.
 *
 * It hides once that block is on screen — two buy buttons visible at once is
 * just noise, and the real one is the better target.
 */
export function CheckoutCtaBar({
  slug,
  previewLabel,
  payLabel,
  /** Templates whose footer fixes a nav to the bottom edge; sit above it. */
  aboveBottomNav,
}: {
  slug: string;
  previewLabel: string;
  payLabel: string;
  aboveBottomNav: boolean;
}) {
  const [atCta, setAtCta] = useState(false);

  // Watch the real CTA block; while it is visible this bar steps aside.
  useEffect(() => {
    const target = document.getElementById(CHECKOUT_CTA_ID);
    if (!target) return;
    const io = new IntersectionObserver(
      ([entry]) => setAtCta(entry.isIntersecting),
      { rootMargin: "-80px 0px 0px 0px" },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  function goToPay() {
    const target = document.getElementById(CHECKOUT_CTA_ID);
    if (!target) return;
    target.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    // Focus the actual control so a keyboard user lands on it, not near it.
    const control = target.querySelector<HTMLElement>("button, a[href]");
    window.setTimeout(() => control?.focus({ preventScroll: true }), 350);
  }

  return (
    <div
      className={`fixed inset-x-0 z-40 transition-[opacity,transform] duration-200 ${
        atCta ? "pointer-events-none translate-y-3 opacity-0" : "opacity-100"
      } ${aboveBottomNav ? "bottom-[4.5rem] md:bottom-0" : "bottom-0"}`}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2 border-t border-[var(--border)] bg-[var(--card)]/95 px-3 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:rounded-t-2xl sm:border sm:px-4">
        <Link
          href={`/preview/${slug}`}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium text-foreground transition-colors hover:bg-[var(--background)] active:scale-[0.99]"
        >
          <EyeIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{previewLabel}</span>
        </Link>
        <button
          type="button"
          onClick={goToPay}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 active:scale-[0.99]"
        >
          <span className="truncate">{payLabel}</span>
        </button>
      </div>
    </div>
  );
}

/** Anchor on the page's real CTA block — the bar scrolls to this, never past it. */
export const CHECKOUT_CTA_ID = "checkout-cta";

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
