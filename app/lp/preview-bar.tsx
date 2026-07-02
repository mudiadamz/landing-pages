"use client";

import { useRouter } from "next/navigation";

export function PreviewBar({ slug }: { slug: string }) {
  const router = useRouter();

  // Always return to this product's checkout page. The preview is opened from
  // there (and from product cards), so a deterministic target beats history.back(),
  // which lands on the wrong page when the preview is opened directly.
  function goBack() {
    router.push(`/checkout/${slug}`);
  }

  return (
    <div className="fixed top-4 left-4 z-50 pointer-events-none">
      <div className="pointer-events-auto flex items-center p-1.5 rounded-xl bg-[var(--card)]/90 backdrop-blur border border-[var(--border)] shadow-lg">
        <button
          type="button"
          onClick={goBack}
          className="p-1.5 rounded-lg text-foreground hover:bg-[var(--background)] active:scale-95 transition-all duration-150"
          aria-label="Kembali"
          title="Kembali"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
      </div>
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
