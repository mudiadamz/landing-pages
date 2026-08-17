"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { useState, useRef, useCallback, useEffect } from "react";
import { addPurchaseAction } from "@/lib/actions/purchases";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { trackEvent } from "@/lib/analytics";
import { trackCta } from "@/lib/track";
import type { LandingPageCheckout } from "@/lib/actions/landing-pages";

type Props = {
  page: LandingPageCheckout;
  isLoggedIn: boolean;
  showAsFree: boolean;
  purchaseLink: string | null;
  /** When set, the CTA adds the product's event to the visitor's calendar (.ics). */
  calendarHref: string | null;
  /** Publisher-set button label override (falls back to a sensible default). */
  ctaLabel: string | null;
};

export function CheckoutForm({
  page,
  isLoggedIn,
  showAsFree,
  purchaseLink,
  calendarHref,
  ctaLabel,
}: Props) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const displayValue = showAsFree
    ? 0
    : page.price_discount && page.price_discount > 0
      ? page.price_discount
      : page.price ?? 0;

  const analyticsItems = [
    { item_id: page.slug, item_name: page.title, price: displayValue, quantity: 1 },
  ];

  // Fire view_item once when the checkout renders.
  useEffect(() => {
    trackEvent("view_item", { currency: "IDR", value: displayValue, items: analyticsItems });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fireBeginCheckout = useCallback(() => {
    trackEvent("begin_checkout", {
      currency: "IDR",
      value: displayValue,
      items: [{ item_id: page.slug, item_name: page.title, price: displayValue, quantity: 1 }],
    });
  }, [displayValue, page.slug, page.title]);

  const triggerShine = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    el.classList.remove("is-shining");
    void el.offsetWidth;
    el.classList.add("is-shining");
  }, []);

  useEffect(() => {
    function onShine() { triggerShine(); }
    window.addEventListener("checkout-shine", onShine);
    return () => window.removeEventListener("checkout-shine", onShine);
  }, [triggerShine]);

  const startDuitku = useCallback(async () => {
    setError(null);
    setLoading(true);
    fireBeginCheckout();
    trackCta(page.slug, "checkout", "buy");
    try {
      const res = await fetch("/api/duitku/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: page.slug }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? t("checkout.invoiceFailed"));
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      throw new Error(t("checkout.noPaymentUrl"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("checkout.processFailed"));
      setLoading(false);
      setAutoContinuing(false);
    }
  }, [fireBeginCheckout, page.slug]);

  async function handleDuitku(e: React.FormEvent) {
    e.preventDefault();
    await startDuitku();
  }

  // Arriving back here after logging in (?pay=1) continues what the visitor
  // already chose on the preview, instead of asking them to press the same
  // button a second time: Duitku for a paid item, the claim for a free one.
  const freeFormRef = useRef<HTMLFormElement>(null);
  const autoPaidRef = useRef(false);
  const [autoContinuing, setAutoContinuing] = useState(false);
  useEffect(() => {
    if (autoPaidRef.current) return;
    if (!isLoggedIn || purchaseLink || calendarHref) return;
    if (new URLSearchParams(window.location.search).get("pay") !== "1") return;
    autoPaidRef.current = true;
    setAutoContinuing(true);
    if (showAsFree) {
      fireBeginCheckout();
      freeFormRef.current?.requestSubmit();
      return;
    }
    void startDuitku();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Continuing automatically after login would otherwise look like a dead page
  // while the invoice is created — show what's happening, and keep it on screen
  // through the redirect to Duitku.
  const overlay = autoContinuing ? (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/85 px-6 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="relative flex h-12 w-12">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-25" />
          <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10">
            <svg
              className="h-6 w-6 animate-spin text-[var(--primary)]"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path
                d="M22 12a10 10 0 0 1-10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {showAsFree ? t("checkout.preparingProduct") : t("checkout.preparingPayment")}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {showAsFree
              ? t("checkout.preparingProductNote")
              : t("checkout.preparingPaymentNote")}
          </p>
        </div>
        {error && (
          <button
            type="button"
            onClick={() => setAutoContinuing(false)}
            className="text-xs font-medium text-red-500 underline underline-offset-2"
          >
            {t("checkout.tapToRetry", { error })}
          </button>
        )}
      </div>
    </div>
  ) : null;

  // Calendar action replaces the purchase CTA entirely: no login, no payment —
  // just hand the visitor an .ics event that works on iOS/Android/desktop.
  if (calendarHref) {
    return (
      <div data-checkout-form>
        <a
          href={calendarHref}
          onClick={() => {
            fireBeginCheckout();
            trackCta(page.slug, "checkout", "calendar");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-4 text-base font-semibold text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/25 transition-all hover:scale-[1.01] hover:shadow-xl hover:shadow-[var(--primary)]/30"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {ctaLabel || "Tambahkan ke kalender"}
        </a>
      </div>
    );
  }

  if (showAsFree) {
    if (isLoggedIn) {
      return (
        <form ref={freeFormRef} action={addPurchaseAction} className="space-y-3" data-checkout-form>
          {overlay}
          <input type="hidden" name="landing_page_id" value={page.id} />
          <Button
            type="submit"
            size="lg"
            fullWidth
            shine
            onClick={() => {
              fireBeginCheckout();
              trackCta(page.slug, "checkout", "buy_free");
            }}
            className="py-4 shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01]"
          >
            Ambil gratis
          </Button>
        </form>
      );
    }
    // ?pay=1 so the claim runs by itself once they're back here logged in.
    const nextAfterLogin = `/checkout/${page.slug}?pay=1`;
    return (
      <div data-checkout-form className="space-y-3">
        <GoogleSignInButton
          next={nextAfterLogin}
          label={t("checkout.freeWithGoogle")}
          variant="primary"
          size="lg"
          shine
          className="gap-3 py-4 shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01]"
        />
        <Link
          href={`/login?next=${encodeURIComponent(nextAfterLogin)}`}
          className="block text-center text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          {t("checkout.orSignInEmail")}
        </Link>
      </div>
    );
  }

  if (purchaseLink) {
    return (
      <div data-checkout-form>
        <Button
          size="lg"
          href={purchaseLink}
          external
          onClick={() => {
            fireBeginCheckout();
            trackCta(page.slug, "checkout", "buy_link");
          }}
          fullWidth
          className="py-4 text-center shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01]"
        >
          {t("checkout.continueToPayment")}
        </Button>
      </div>
    );
  }

  if (!isLoggedIn) {
    // ?pay=1 makes the checkout page auto-start the Duitku payment once the
    // user lands back here logged in (see the auto-pay effect above).
    const nextAfterLogin = `/checkout/${page.slug}?pay=1`;
    return (
      <div data-checkout-form className="space-y-3">
        <GoogleSignInButton
          next={nextAfterLogin}
          label={t("checkout.withGoogle")}
          variant="primary"
          size="lg"
          shine
          className="gap-3 py-4 shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01]"
        />
        <Link
          href={`/login?next=${encodeURIComponent(nextAfterLogin)}`}
          className="block text-center text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          {t("checkout.orSignInEmail")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleDuitku} className="space-y-4" data-checkout-form>
      {overlay}
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}
      <Button
        ref={btnRef}
        type="submit"
        size="lg"
        fullWidth
        shine
        loading={loading}
        disabled={loading}
        className="py-4 shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01] disabled:shadow-none"
      >
        {loading ? (
          t("checkout.processing")
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {t("checkout.payNow")}
          </span>
        )}
      </Button>
    </form>
  );
}
