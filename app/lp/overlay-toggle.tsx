"use client";

import { useState } from "react";

export function OverlayToggle() {
  const [hidden, setHidden] = useState(false);

  function toggle() {
    setHidden((prev) => {
      const next = !prev;
      document.body.classList.toggle("lp-hide-overlays", next);
      return next;
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={hidden ? "Tampilkan tombol" : "Sembunyikan tombol"}
      className="fixed bottom-4 right-4 z-50 p-2.5 rounded-full bg-[var(--card)]/80 backdrop-blur border border-[var(--border)] text-[var(--foreground)] shadow-lg hover:bg-[var(--card)] active:scale-95 transition-all duration-150"
    >
      {hidden ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
    </button>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
    </svg>
  );
}
