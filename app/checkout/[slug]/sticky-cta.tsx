"use client";

type Props = {
  priceLabel: string;
  slug: string;
  showAsFree: boolean;
};

export function StickyMobileCTA({ priceLabel, slug, showAsFree }: Props) {
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
    <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-lg font-bold text-foreground truncate">{priceLabel}</span>
      <button
        type="button"
        onClick={handleClick}
        className="shrink-0 px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 active:scale-[0.97] transition-all"
      >
        {showAsFree ? "Ambil gratis" : "Bayar sekarang"}
      </button>
    </div>
  );
}
