"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  slug: string;
  isLoggedIn: boolean;
  showAsFree: boolean;
  purchaseLink: string | null;
};

export function PreviewBar({ slug, isLoggedIn, showAsFree, purchaseLink }: Props) {
  const [buying, setBuying] = useState(false);

  const checkoutHref = `/checkout/${slug}`;
  const loginHref = `/login?next=${encodeURIComponent(`${checkoutHref}?pay=1`)}`;
  const buyLabel = showAsFree ? "Ambil gratis" : "Beli";

  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex items-start gap-2 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-xl bg-[var(--card)]/90 backdrop-blur border border-[var(--border)] shadow-lg">
        <Link
          href="/"
          className="p-1.5 rounded-lg text-foreground hover:bg-[var(--background)] active:scale-95 transition-all duration-150"
          aria-label="Kembali ke beranda"
          title="Kembali ke beranda"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>

        <div className="w-px h-5 bg-[var(--border)]" />

        <button
          type="button"
          onClick={() => setBuying((v) => !v)}
          aria-expanded={buying}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.97] transition-all duration-150"
        >
          <CartIcon className="w-4 h-4" />
          {buyLabel}
        </button>
      </div>

      {buying && (
        <div className="pointer-events-auto w-52 p-2 rounded-xl bg-[var(--card)]/95 backdrop-blur border border-[var(--border)] shadow-lg space-y-2">
          {purchaseLink ? (
            <a
              href={purchaseLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center px-3 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all duration-150"
            >
              Lanjutkan ke pembayaran
            </a>
          ) : (
            <Link
              href={checkoutHref}
              className="block text-center px-3 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all duration-150"
            >
              {showAsFree ? "Ambil gratis" : "Bayar sekarang"}
            </Link>
          )}
          {!isLoggedIn && !purchaseLink && (
            <Link
              href={loginHref}
              className="block text-center text-xs text-[var(--muted)] hover:text-foreground transition-colors"
            >
              atau login dulu
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
