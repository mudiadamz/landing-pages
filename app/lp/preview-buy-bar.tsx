"use client";

import { useEffect, useRef, useState } from "react";
import { trackCta } from "@/lib/track";
import { useChromeHidden } from "@/lib/immersive";

/** Short buzz on tap where supported (Android Chrome; no-op on iOS). */
function buzz() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(8);
  }
}

type Props = {
  /** Where the CTA leads: /checkout/[slug], an external link, or the .ics route. */
  href: string;
  /** When true, the link opens in a new tab (external purchase link). */
  external?: boolean;
  /** Swap the cart icon for a calendar icon when the action is "add to calendar". */
  calendar?: boolean;
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
  /** Product slug + CTA action name for analytics (fired on click). */
  slug?: string;
  ctaAction?: string;
};

/**
 * Sticky bottom "Beli sekarang" CTA on the preview page. Stays out of the way
 * until the visitor has scrolled a few screens into the demo, then slides up.
 * Scroll is reported from inside the preview: the guard script postMessages for
 * HTML previews, and PdfViewer dispatches `lp-preview-scroll` for PDFs. The
 * visitor can dismiss it (collapses to a small handle) and bring it back.
 */
export function PreviewBuyBar({ href, external, calendar, label, priceText, note, autoRevealMs, slug, ctaAction }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [hidden, setHidden] = useState(false);
  // The collapsed handle sits in the same bottom-right corner as the bar's close
  // (X) button. Showing it the instant the bar is dismissed makes it bloom right
  // under the finger — a mis-tap trap. Delay it until the bar has slid away.
  const [handleReady, setHandleReady] = useState(false);

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

  // Dismiss (X): hide the bar now, then bring the collapsed handle in ~half a
  // second later — after the bar's 300ms slide-out — so it doesn't bloom right
  // under the finger that just tapped X. Restore: drop the handle immediately.
  const handleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = () => {
    setHidden(true);
    if (handleTimer.current) clearTimeout(handleTimer.current);
    handleTimer.current = setTimeout(() => setHandleReady(true), 500);
  };
  const restore = () => {
    if (handleTimer.current) clearTimeout(handleTimer.current);
    setHandleReady(false);
    setHidden(false);
  };
  useEffect(() => () => {
    if (handleTimer.current) clearTimeout(handleTimer.current);
  }, []);

  // Focus mode: fade the whole CTA away with the rest of the chrome.
  const chromeHidden = useChromeHidden();
  const showBar = revealed && !hidden && !chromeHidden;
  const showHandle = revealed && hidden && handleReady && !chromeHidden;

  return (
    <>
      {/* CTA bar — fully transparent wrapper so only the card floats over the
          reader (no background fill behind it / near the Safari bar). */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-all duration-300 ease-out ${
          showBar ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        {/* No card/background — the whole CTA is one floating button that carries
            the price + note on the left and the label on the right. */}
        <div className="pointer-events-auto relative mx-auto flex max-w-md">
          <a
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            onPointerDown={buzz}
            onClick={() => {
              if (slug) trackCta(slug, "preview", ctaAction || "buy");
            }}
            className="flex w-full items-center gap-3 rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-[var(--primary-foreground)] shadow-xl shadow-[var(--primary)]/30 touch-manipulation transition-transform hover:scale-[1.01] active:scale-[0.98]"
          >
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-bold leading-tight">
                {priceText ?? "Gratis"}
              </span>
              <span className="block truncate text-[11px] font-medium leading-tight opacity-90">
                {note ??
                  (priceText
                    ? "Miliki sekarang — akses penuh, selamanya."
                    : "Ambil sekarang — akses penuh, selamanya.")}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold">
              {calendar ? <CalendarIcon className="h-4 w-4" /> : <CartIcon className="h-4 w-4" />}
              {label}
            </span>
          </a>

          {/* Dismiss pinned to the top-right corner, floating just above the bar
              over the preview. Big transparent hit area sits above the CTA, not
              on it; drop-shadow keeps the bare icon legible. */}
          <button
            type="button"
            onPointerDown={buzz}
            onClick={dismiss}
            aria-label="Sembunyikan tombol beli"
            title="Sembunyikan"
            className="absolute bottom-full right-0 mb-1 flex h-10 w-10 items-center justify-center text-foreground [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.45))] touch-manipulation transition-transform duration-150 active:scale-90"
          >
            <CloseIcon className="h-5 w-5" />
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
          onPointerDown={buzz}
          onClick={restore}
          aria-label="Tampilkan tombol beli"
          title="Tampilkan tombol beli"
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary)]/30 touch-manipulation transition-transform hover:scale-105 active:scale-95"
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

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
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
