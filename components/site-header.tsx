"use client";

import Link from "next/link";
import { useState } from "react";
import { ThemeSwitch } from "@/components/theme-switch";

type Props = { user: { id: string } | null };

const navLinks = [
  { href: "/", label: "Beranda" },
  { href: "/about", label: "Tentang" },
  { href: "/contact", label: "Kontak" },
  { href: "/privacy", label: "Kebijakan Privasi" },
  { href: "/terms", label: "Ketentuan" },
];

export function SiteHeader({ user }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--card)]/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-base sm:text-lg font-semibold tracking-tight shrink-0 text-foreground hover:opacity-80 transition-opacity"
        >
          ADM.UIUX
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-2 text-sm text-[var(--muted)] hover:text-foreground rounded-lg hover:bg-[var(--accent-subtle)] active:scale-[0.98] active:opacity-80 transition-all duration-150"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeSwitch />
          {user ? (
            <Link
              href="/panel"
              className="px-3 sm:px-4 py-2 text-sm font-medium text-[var(--primary)] rounded-lg hover:bg-[var(--accent-subtle)] active:scale-[0.98] active:opacity-80 transition-all duration-150"
            >
              Panel
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3 sm:px-4 py-2 text-sm text-[var(--muted)] hover:text-foreground rounded-lg hover:bg-[var(--accent-subtle)] active:scale-[0.98] active:opacity-80 transition-all duration-150"
            >
              Masuk
            </Link>
          )}
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 -mr-2 rounded-lg text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)] active:scale-[0.95] active:opacity-80 transition-all duration-150"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--card)]">
          <nav className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-0.5">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-sm text-[var(--muted)] hover:text-foreground rounded-lg hover:bg-[var(--accent-subtle)] active:scale-[0.98] active:bg-[var(--accent-subtle)] active:opacity-90 transition-all duration-150"
              >
                {label}
              </Link>
            ))}
            {!user && (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 mt-2 pt-4 border-t border-[var(--border)] text-sm text-[var(--muted)] hover:text-foreground rounded-lg hover:bg-[var(--accent-subtle)] active:scale-[0.98] active:bg-[var(--accent-subtle)] active:opacity-90 transition-all duration-150"
              >
                Masuk
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
