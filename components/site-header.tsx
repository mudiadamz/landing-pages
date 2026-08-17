"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { useMemo, useState, useRef, useEffect } from "react";
import { signOut } from "@/lib/actions/auth";
import { CategoryIcon } from "@/lib/category-icons";
import { SiteLogo } from "@/components/site-logo";
import type { SiteBrand } from "@/lib/site-brand";

type User = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string | null } | null;
};

export type HeaderCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  /** NULL = top-level (parent); set = sub-category of that parent. */
  parent_id?: string | null;
};

type Props = {
  user: User | null;
  categories?: HeaderCategory[];
  currentCategorySlug?: string | null;
  /**
   * Which storefront's identity to draw. This component is a client component, so
   * it cannot read the site row itself — the brand arrives as a prop, resolved by
   * whichever server component renders the shell.
   */
  brand: SiteBrand;
};

function displayName(user: User): string {
  const name = user.user_metadata?.full_name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0];
  return "User";
}

const navLinks: { href: string; labelKey: MessageKey }[] = [
  { href: "/about", labelKey: "nav.about" },
  { href: "/contact", labelKey: "nav.contact" },
  { href: "/privacy", labelKey: "nav.privacyPolicy" },
  { href: "/terms", labelKey: "nav.terms" },
];

/**
 * Horizontal scroller for the category chips.
 *
 * The fade is a mask, not a gradient overlay: the rail sits on three different
 * surfaces (card, tinted strip, and whatever the theme is) and an overlay would
 * need to know the colour behind it. A mask fades whatever is actually there,
 * in both themes, with no colour knowledge at all.
 *
 * `overscroll-x-contain` matters on iOS — without it, flicking the rail past its
 * end hands the gesture to the page and triggers the back-swipe.
 */
function Rail({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={
        "flex items-center gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth " +
        "snap-x snap-proximity [scrollbar-width:none] [-ms-overflow-style:none] " +
        "[&::-webkit-scrollbar]:hidden " +
        "[mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-14px),transparent)] " +
        className
      }
    >
      {children}
    </div>
  );
}

export function SiteHeader({ user, brand, categories = [], currentCategorySlug = null }: Props) {
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLAnchorElement>(null);
  const activeSubRef = useRef<HTMLAnchorElement>(null);

  // ─── Build the 2-level tree from the flat list ───
  const { parents, activeParent, activeChildSlug, subCats } = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const parents = categories.filter((c) => !c.parent_id);
    const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);
    const current = currentCategorySlug
      ? categories.find((c) => c.slug === currentCategorySlug) ?? null
      : null;
    const activeParent = current
      ? current.parent_id
        ? byId.get(current.parent_id) ?? current
        : current
      : null;
    const activeChildSlug = current && current.parent_id ? current.slug : null;
    const subCats = activeParent ? childrenOf(activeParent.id) : [];
    return { parents, activeParent, activeChildSlug, subCats };
  }, [categories, currentCategorySlug]);

  const showCategories = parents.length > 0;
  const activeParentId = activeParent?.id ?? null;

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

  // Bring the active chip into view. On a phone the rail is a handful of chips
  // wide, so the one you're actually on is routinely off-screen at load — which
  // reads as "the category bar forgot where I am".
  useEffect(() => {
    for (const el of [activeChipRef.current, activeSubRef.current]) {
      el?.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [currentCategorySlug]);

  const chip = (active: boolean) =>
    `snap-start shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] ` +
    `font-medium whitespace-nowrap transition-colors duration-150 active:scale-[0.97] ` +
    (active
      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
      : "border border-[var(--border)] bg-[var(--background)]/60 text-[var(--muted)] hover:text-foreground hover:border-[var(--primary)]/40");

  const subChip = (active: boolean) =>
    `snap-start shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ` +
    `whitespace-nowrap transition-colors duration-150 active:scale-[0.97] ` +
    (active
      ? "bg-[var(--accent-subtle)] text-[var(--primary)] font-semibold"
      : "text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)]");

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--card)]/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 min-w-0">
          <Link
            href="/"
            aria-label={brand.name}
            className="flex items-center gap-2 text-base sm:text-lg font-semibold tracking-tight shrink-0 text-foreground hover:opacity-80 transition-opacity"
          >
            <SiteLogo brand={brand} />
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {/* Dark/light toggle hidden for now — the palette per storefront is the
                intended way to set the look. Component kept; re-add to restore. */}
            {/* Auth control is hidden on mobile — the bottom nav + hamburger menu
                cover profile/login there. Shown from md upward. */}
            <div className="hidden md:flex items-center">
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
                        {t("panel.navPurchases")}
                      </Link>
                      <form action={signOut} className="block">
                        <button
                          type="submit"
                          className="w-full text-left px-4 py-2.5 text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)]"
                        >
                          Keluar
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
            </div>
            <button
              type="button"
              aria-label={t("panel.openMenu")}
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

        {/* Categories, at every size. They used to be desktop-only, with phones
            reaching them through a nested accordion behind the hamburger — two
            taps and a scroll to change category. A rail costs one swipe. */}
        {showCategories ? (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-2">
            <Rail>
              {parents.map((cat) => {
                const active = activeParentId === cat.id;
                return (
                  <Link
                    key={cat.id}
                    ref={active ? activeChipRef : undefined}
                    href={`/category/${cat.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={chip(active)}
                  >
                    <CategoryIcon icon={cat.icon} className="w-4 h-4" active={active} />
                    {cat.name}
                  </Link>
                );
              })}
              <Link
                href="/categories"
                className="snap-start shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-[var(--muted)] hover:text-foreground transition-colors"
              >
                {t("home.allArrow")}
              </Link>
            </Rail>
          </div>
        ) : (
          <div className="hidden md:block max-w-5xl mx-auto px-4 sm:px-6 pb-2">
            <Rail>
              {navLinks.map(({ href, labelKey }) => (
                <Link
                  key={href}
                  href={href}
                  className="snap-start shrink-0 rounded-full px-3 py-1.5 text-[13px] text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)] transition-colors whitespace-nowrap"
                >
                  {t(labelKey)}
                </Link>
              ))}
            </Rail>
          </div>
        )}

        {/* Mobile menu — categories live in the rail now, so this is only the
            things the rail can't hold: account, and the standing pages. */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[var(--border)] bg-[var(--card)]">
            <nav className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-0.5">
              <Link
                href="/categories"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-foreground rounded-xl bg-[var(--accent-subtle)]"
              >
                {t("panel.allCategories")}
                <span aria-hidden className="text-[var(--primary)]">→</span>
              </Link>
              {navLinks.map(({ href, labelKey }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm text-[var(--muted)] hover:text-foreground rounded-lg hover:bg-[var(--accent-subtle)] active:opacity-90 transition-all duration-150"
                >
                  {t(labelKey)}
                </Link>
              ))}
              {user ? (
                <div className="mt-2 pt-3 border-t border-[var(--border)] flex flex-col gap-0.5">
                  <Link
                    href="/panel"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2.5 text-sm text-foreground rounded-lg hover:bg-[var(--accent-subtle)]"
                  >
                    {t("panel.navPurchases")}
                  </Link>
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="block w-full text-left px-3 py-2.5 text-sm text-[var(--muted)] hover:text-foreground rounded-lg hover:bg-[var(--accent-subtle)]"
                    >
                      Keluar
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 mt-2 pt-3 border-t border-[var(--border)] text-sm text-[var(--muted)] hover:text-foreground rounded-lg hover:bg-[var(--accent-subtle)] transition-all duration-150"
                >
                  Masuk
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Sub-categories sit OUTSIDE the sticky header on purpose. Pinning both
          rails costs ~145px of a phone screen before any product is visible;
          this way the parent rail stays reachable and the narrower choice
          scrolls away once you've made it. */}
      {showCategories && subCats.length > 0 && activeParent && (
        <div className="border-b border-[var(--border)] bg-[var(--background)]/50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <Rail className="py-1.5">
              <Link
                href={`/category/${activeParent.slug}`}
                ref={!activeChildSlug ? activeSubRef : undefined}
                aria-current={!activeChildSlug ? "page" : undefined}
                className={subChip(!activeChildSlug)}
              >
                Semua {activeParent.name}
              </Link>
              <span className="shrink-0 text-[var(--border)]" aria-hidden>
                ·
              </span>
              {subCats.map((sub) => {
                const active = activeChildSlug === sub.slug;
                return (
                  <Link
                    key={sub.id}
                    ref={active ? activeSubRef : undefined}
                    href={`/category/${sub.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={subChip(active)}
                  >
                    <CategoryIcon icon={sub.icon} className="w-3.5 h-3.5" active={active} />
                    {sub.name}
                  </Link>
                );
              })}
            </Rail>
          </div>
        </div>
      )}
    </>
  );
}
