"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import { addPurchaseAction } from "@/lib/actions/purchases";
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

  async function handleDuitku(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }

  const ctaBtnClass =
    "w-full px-5 py-4 text-base font-semibold rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200";

  if (showAsFree) {
    if (isLoggedIn) {
      return (
        <form action={addPurchaseAction} className="space-y-3" data-checkout-form>
          <input type="hidden" name="landing_page_id" value={page.id} />
          <button type="submit" className={`btn-cta-shine ${ctaBtnClass}`}>
            Ambil gratis
          </button>
        </form>
      );
    }
    return (
      <div data-checkout-form>
        <Link
          href={`/login?next=${encodeURIComponent(`/checkout/${page.slug}`)}`}
          className={`block text-center ${ctaBtnClass}`}
        >
          Masuk untuk ambil gratis
        </Link>
      </div>
    );
  }

  if (purchaseLink) {
    return (
      <div data-checkout-form>
        <a
          href={purchaseLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`block text-center ${ctaBtnClass}`}
        >
          Lanjutkan ke pembayaran
        </a>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div data-checkout-form>
        <Link
          href={`/login?next=${encodeURIComponent(`/checkout/${page.slug}`)}`}
          className={`block text-center ${ctaBtnClass}`}
        >
          Masuk untuk checkout
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleDuitku} className="space-y-4" data-checkout-form>
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}
      <button
        ref={btnRef}
        type="submit"
        disabled={loading}
        className="btn-cta-shine w-full px-5 py-4 text-base font-semibold rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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
      </button>
    </form>
  );
}
