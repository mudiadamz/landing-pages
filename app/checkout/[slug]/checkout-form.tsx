"use client";

import Link from "next/link";
import { useState } from "react";
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

  if (showAsFree) {
    if (isLoggedIn) {
      return (
        <form action={addPurchaseAction} className="space-y-3">
          <input type="hidden" name="landing_page_id" value={page.id} />
          <button
            type="submit"
            className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity"
          >
            Ambil gratis
          </button>
        </form>
      );
    }
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/checkout/${page.slug}`)}`}
        className="block w-full px-4 py-3 text-sm font-medium text-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity"
      >
        Masuk untuk ambil gratis
      </Link>
    );
  }

  // Berbayar — external link
  if (purchaseLink) {
    return (
      <a
        href={purchaseLink}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full px-4 py-3 text-sm font-medium text-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity"
      >
        Lanjutkan ke pembayaran
      </a>
    );
  }

  // Berbayar — Duitku (internal checkout)
  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/checkout/${page.slug}`)}`}
        className="block w-full px-4 py-3 text-sm font-medium text-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity"
      >
        Masuk untuk melanjutkan pembelian
      </Link>
    );
  }

  // Logged in: no email/phone fields, API uses session user
  return (
    <form onSubmit={handleDuitku} className="space-y-4">
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Memproses…" : "Bayar via Duitku"}
      </button>
    </form>
  );
}
