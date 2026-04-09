"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  buyHref?: string;
  buyLabel?: string;
  buyDescription?: string;
  isExternal?: boolean;
};

export function PreviewBar({ buyHref, buyLabel, buyDescription, isExternal }: Props) {
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        title="Tampilkan toolbar"
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-[var(--card)]/90 backdrop-blur border border-[var(--border)] text-[var(--muted)] shadow-lg hover:text-foreground hover:bg-[var(--card)] active:scale-95 transition-all duration-150"
      >
        <ChevronDownIcon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex items-center gap-2 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-xl bg-[var(--card)]/90 backdrop-blur border border-[var(--border)] shadow-lg">
        <Link
          href="/"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-[var(--background)] active:scale-[0.97] transition-all duration-150"
          aria-label="Kembali ke beranda"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Kembali</span>
        </Link>

        <div className="w-px h-5 bg-[var(--border)]" />

        <button
          type="button"
          onClick={() => setHidden(true)}
          title="Sembunyikan toolbar"
          className="p-1.5 rounded-lg text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] active:scale-95 transition-all duration-150"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1" />

      {buyHref && buyLabel && (
        <Link
          href={buyHref}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          title={buyDescription}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-medium text-sm shadow-lg hover:opacity-95 active:scale-[0.97] active:opacity-90 transition-all duration-150"
        >
          <CheckoutIcon className="w-4 h-4" />
          {buyLabel}
        </Link>
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

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}
