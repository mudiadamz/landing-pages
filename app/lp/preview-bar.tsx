"use client";

import { useRouter } from "next/navigation";

export function PreviewBar() {
  const router = useRouter();

  // Go back to wherever the user came from; fall back to home if the preview
  // was opened directly (no in-app history to pop).
  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
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
