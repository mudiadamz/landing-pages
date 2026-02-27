"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "@/lib/actions/auth";

type Props = {
  isAdmin: boolean;
};

export function PanelHeader({ isAdmin }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)]/98 backdrop-blur supports-[backdrop-filter]:bg-[var(--card)]/95">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 -ml-2 rounded-lg text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/panel"
              className="px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-[var(--background)] transition-colors"
            >
              {isAdmin ? "Landing pages" : "Pembelian saya"}
            </Link>
            {isAdmin && (
              <>
                <Link
                  href="/panel/dashboard"
                  className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/panel/upload"
                  className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
                >
                  Upload HTML
                </Link>
                <Link
                  href="/panel/landing-pages/new"
                  className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
                >
                  Halaman baru
                </Link>
              </>
            )}
          </nav>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
          >
            Keluar
          </button>
        </form>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-[var(--border)] bg-[var(--card)] py-3 px-4 flex flex-col gap-0.5">
          <Link
            href="/panel"
            onClick={() => setMobileOpen(false)}
            className="px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-[var(--background)]"
          >
            {isAdmin ? "Landing pages" : "Pembelian saya"}
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/panel/dashboard"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)]"
              >
                Dashboard
              </Link>
              <Link
                href="/panel/upload"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)]"
              >
                Upload HTML
              </Link>
              <Link
                href="/panel/landing-pages/new"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)]"
              >
                Halaman baru
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
