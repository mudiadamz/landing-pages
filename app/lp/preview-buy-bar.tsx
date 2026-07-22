"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  /** Where the CTA leads: this site's /checkout/[slug] or an external link. */
  href: string;
  /** When true, the link opens in a new tab (external purchase link). */
  external?: boolean;
  /** CTA label, e.g. "Beli sekarang" or "Ambil gratis". */
  label: string;
  /** Formatted price shown above the CTA; null renders "Gratis". */
  priceText: string | null;
  /** Optional subtitle override; null uses the derived default. */
  note?: string | null;
  /**
   * Fallback reveal delay (ms) for previews where scroll can't be observed
   * (external-link iframes are cross-origin). 0/undefined = scroll-only.
   */
  autoRevealMs?: number;
};

/**
 * Sticky bottom "Beli sekarang" CTA on the preview page. Stays out of the way
 * until the visitor has scrolled a few screens into the demo, then slides up.
 * Scroll is reported from inside the preview: the guard script postMessages for
 * HTML previews, and PdfViewer dispatches `lp-preview-scroll` for PDFs. The
 * visitor can dismiss it (collapses to a small handle) and bring it back.
 */
export function PreviewBuyBar({ href, external, label, priceText, note, autoRevealMs }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const reveal = () => setRevealed(true);

    function onMessage(e: MessageEvent) {
      const d = e.data as { __lpPreview?: unknown; scrolled?: unknown } | null;
      if (d && typeof d === "object" && d.__lpPreview && d.scrolled) reveal();
    }
    function onScrollEvent(e: Event) {
      if ((e as CustomEvent<{ past?: boolean }>).detail?.past) reveal();
    }

    window.addEventListener("message", onMessage);
    window.addEventListener("lp-preview-scroll", onScrollEvent as EventListener);
    const timer =
      autoRevealMs && autoRevealMs > 0 ? setTimeout(reveal, autoRevealMs) : undefined;

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("lp-preview-scroll", onScrollEvent as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, [autoRevealMs]);

  const showBar = revealed && !hidden;
  const showHandle = revealed && hidden;

  return (
    <>
      {/* CTA bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-all duration-300 ease-out ${
          showBar ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        {/* Solid (no backdrop-blur): a fixed backdrop-filter at the bottom edge
            makes iOS Safari frost its toolbar lighter. The card was already 95%
            opaque, so an opaque bg looks the same without the side effect. */}
        <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 pl-4 shadow-xl">
          <div className="min-w-0 flex-1">
            {priceText ? (
              <p className="truncate text-sm font-semibold text-foreground">{priceText}</p>
            ) : (
              <p className="truncate text-sm font-semibold text-[var(--primary)]">Gratis</p>
            )}
            <p className="truncate text-xs text-[var(--muted)]">
              {note ??
                (priceText
                  ? "Miliki sekarang — akses penuh, selamanya."
                  : "Ambil sekarang — akses penuh, selamanya.")}
            </p>
          </div>
          <Link
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-md shadow-[var(--primary)]/25 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <CartIcon className="h-4 w-4" />
            {label}
          </Link>
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="Sembunyikan tombol beli"
            title="Sembunyikan"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-all hover:bg-[var(--background)] hover:text-foreground active:scale-95"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Collapsed handle — brings the CTA back after it's dismissed */}
      <div
        className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ease-out ${
          showHandle ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={() => setHidden(false)}
          aria-label="Tampilkan tombol beli"
          title="Tampilkan tombol beli"
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/30 transition-transform hover:scale-105 active:scale-95"
        >
          <CartIcon className="h-5 w-5" />
        </button>
      </div>
    </>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
