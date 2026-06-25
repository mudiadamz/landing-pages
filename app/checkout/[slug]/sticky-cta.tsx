"use client";

import { Button } from "@/components/ui/button";

type Props = {
  priceLabel: string;
  slug: string;
  showAsFree: boolean;
};

export function StickyMobileCTA({ priceLabel, showAsFree }: Props) {
  function handleClick() {
    const form = document.querySelector<HTMLElement>("[data-checkout-form]");
    if (form) {
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("checkout-shine"));
    }, 400);
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm px-4 py-2.5">
      {!showAsFree && (
        <p className="mb-1.5 flex items-center justify-center gap-1.5 text-[10px] text-[var(--muted)]">
          <svg className="w-3 h-3 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Garansi 7 hari uang kembali · Bayar QRIS / e-wallet
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-lg font-bold text-foreground truncate">{priceLabel}</span>
        <Button
          size="md"
          onClick={handleClick}
          className="shrink-0 px-5 py-2.5 text-sm rounded-lg active:scale-[0.97]"
        >
          {showAsFree ? "Ambil gratis" : "Bayar sekarang"}
        </Button>
      </div>
    </div>
  );
}
