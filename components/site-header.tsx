"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ThemeSwitch } from "@/components/theme-switch";
import { signOut } from "@/lib/actions/auth";
import { CategoryIcon } from "@/lib/category-icons";

type User = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string | null } | null;
};

export type HeaderCategory = { id: string; name: string; slug: string; icon: string };

const iconClass = "w-4 h-4 shrink-0";

type Props = {
  user: User | null;
  categories?: HeaderCategory[];
  currentCategorySlug?: string | null;
};

function displayName(user: User): string {
  const name = user.user_metadata?.full_name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0];
  return "User";
}

const navLinks = [
  { href: "/", label: "Beranda" },
  { href: "/about", label: "Tentang" },
  { href: "/contact", label: "Kontak" },
  { href: "/privacy", label: "Kebijakan Privasi" },
  { href: "/terms", label: "Ketentuan" },
];

export function SiteHeader({ user, categories = [], currentCategorySlug = null }: Props) {
  const showCategories = categories.length > 0;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [userMenuOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--card)]/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 min-w-0">
        <Link
          href="/"
          className="text-base sm:text-lg font-semibold tracking-tight shrink-0 text-foreground hover:opacity-80 transition-opacity"
        >
          ADM.UIUX
        </Link>

        <nav className="hidden md:flex items-center min-w-0 flex-1 justify-center overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-1.5 flex-nowrap py-1">
            {showCategories ? (
              <>
                <Link
                  href="/"
                  className={`flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg transition-all duration-150 shrink-0 ${
                    !currentCategorySlug
                      ? "bg-[var(--accent-subtle)] text-[var(--primary)] font-medium"
                      : "text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)] active:opacity-80"
                  }`}
                >
                  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="whitespace-nowrap">Home</span>
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/?category=${encodeURIComponent(cat.slug)}`}
                    className={`flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg transition-all duration-150 shrink-0 ${
                      currentCategorySlug === cat.slug
                        ? "bg-[var(--accent-subtle)] text-[var(--primary)] font-medium"
                        : "text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)] active:opacity-80"
                    }`}
                  >
                    <CategoryIcon icon={cat.icon} className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">{cat.name}</span>
                  </Link>
                ))}
              </>
            ) : (
              navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-2.5 py-2 text-sm text-[var(--muted)] hover:text-foreground rounded-lg hover:bg-[var(--accent-subtle)] active:opacity-80 transition-all duration-150 shrink-0"
                >
                  {label}
                </Link>
              ))
            )}
          </div>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeSwitch />
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                className="px-3 sm:px-4 py-2 text-sm font-medium text-foreground rounded-lg hover:bg-[var(--accent-subtle)] active:scale-[0.98] active:opacity-80 transition-all duration-150 flex items-center gap-1.5"
              >
                <span className="max-w-[120px] truncate">{displayName(user)}</span>
                <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 py-1 min-w-[160px] rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg z-30">
                  <Link
                    href="/panel"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm text-foreground hover:bg-[var(--accent-subtle)]"
                  >
                    Go to panel
                  </Link>
                  <form action={signOut} className="block">
                    <button
                      type="submit"
                      className="w-full text-left px-4 py-2.5 text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)]"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
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
            {showCategories ? (
              <>
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg ${
                    !currentCategorySlug ? "text-[var(--primary)] font-medium bg-[var(--accent-subtle)]" : "text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)]"
                  }`}
                >
                  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Home
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/?category=${encodeURIComponent(cat.slug)}`}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg ${
                      currentCategorySlug === cat.slug ? "text-[var(--primary)] font-medium bg-[var(--accent-subtle)]" : "text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)]"
                    }`}
                  >
                    <CategoryIcon icon={cat.icon} className="w-4 h-4 shrink-0" />
                    {cat.name}
                  </Link>
                ))}
              </>
            ) : (
              navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm text-[var(--muted)] hover:text-foreground rounded-lg hover:bg-[var(--accent-subtle)] active:scale-[0.98] active:bg-[var(--accent-subtle)] active:opacity-90 transition-all duration-150"
                >
                  {label}
                </Link>
              ))
            )}
            {user ? (
              <div className="mt-2 pt-4 border-t border-[var(--border)] flex flex-col gap-0.5">
                <Link
                  href="/panel"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm text-foreground rounded-lg hover:bg-[var(--accent-subtle)]"
                >
                  Go to panel
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="block w-full text-left px-3 py-2.5 text-sm text-[var(--muted)] hover:text-foreground rounded-lg hover:bg-[var(--accent-subtle)]"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
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
