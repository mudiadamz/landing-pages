"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import { addPurchaseAction } from "@/lib/actions/purchases";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { trackEvent } from "@/lib/analytics";
import type { LandingPageCheckout } from "@/lib/actions/landing-pages";

type Props = {
  page: LandingPageCheckout;
  isLoggedIn: boolean;
  showAsFree: boolean;
  purchaseLink: string | null;
};

export function CheckoutForm({
  page,
  isLoggedIn,
  showAsFree,
  purchaseLink,
}: Props) {
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
    try {
      const res = await fetch("/api/duitku/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: page.slug }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Gagal membuat invoice");
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      throw new Error("URL pembayaran tidak diterima");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses");
      setLoading(false);
    }
  }, [fireBeginCheckout, page.slug]);

  async function handleDuitku(e: React.FormEvent) {
    e.preventDefault();
    await startDuitku();
  }

  // After logging in via the buttons on this page (?pay=1), go straight to
  // the Duitku payment instead of making the user click "Bayar sekarang" again.
  const autoPaidRef = useRef(false);
  useEffect(() => {
    if (autoPaidRef.current) return;
    if (!isLoggedIn || showAsFree || purchaseLink) return;
    if (new URLSearchParams(window.location.search).get("pay") !== "1") return;
    autoPaidRef.current = true;
    void startDuitku();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showAsFree) {
    if (isLoggedIn) {
      return (
        <form action={addPurchaseAction} className="space-y-3" data-checkout-form>
          <input type="hidden" name="landing_page_id" value={page.id} />
          <Button
            type="submit"
            size="lg"
            fullWidth
            shine
            onClick={fireBeginCheckout}
            className="py-4 shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01]"
          >
            Ambil gratis
          </Button>
        </form>
      );
    }
    return (
      <div data-checkout-form className="space-y-3">
        <GoogleSignInButton
          next={`/checkout/${page.slug}`}
          label="Ambil gratis dengan Google"
          variant="primary"
          size="lg"
          shine
          className="gap-3 py-4 shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01]"
        />
        <Link
          href={`/login?next=${encodeURIComponent(`/checkout/${page.slug}`)}`}
          className="block text-center text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          atau masuk dengan email
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
          onClick={fireBeginCheckout}
          fullWidth
          className="py-4 text-center shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01]"
        >
          Lanjutkan ke pembayaran
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
          label="Checkout dengan Google"
          variant="primary"
          size="lg"
          shine
          className="gap-3 py-4 shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01]"
        />
        <Link
          href={`/login?next=${encodeURIComponent(nextAfterLogin)}`}
          className="block text-center text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          atau masuk dengan email
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleDuitku} className="space-y-4" data-checkout-form>
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
          "Memproses…"
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Bayar sekarang
          </span>
        )}
      </Button>
    </form>
  );
}
