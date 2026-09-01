"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitch } from "@/components/theme-switch";
import { SiteLogo } from "@/components/site-logo";
import { usePanelChrome } from "@/components/panel-chrome";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n";
import type { SiteBrand } from "@/lib/site-brand";

type AccountType = "company" | "agent" | "customer";

/**
 * The panel's top bar, in the content pane rather than across the whole window.
 *
 * It replaces the bar the sidebar used to render for itself, which was
 * `sticky top-0` inside the flex row — so on a phone it scrolled with the page it
 * was supposed to sit above, and on a desktop it did not exist at all, leaving no
 * home for anything that is about the SESSION rather than about navigation.
 *
 * Everything session-shaped now lives in one menu behind the avatar: who you are,
 * the two preferences, and the way out. They used to be spread across three
 * places in the sidebar — an identity card, a language control, a theme button,
 * and a sign-out row at the very bottom of the nav.
 */
export function PanelTopbar({
  displayName,
  email,
  accountType,
  avatarUrl = "",
  brand,
  locale,
}: {
  displayName: string;
  email: string | null;
  accountType?: AccountType;
  avatarUrl?: string;
  brand: SiteBrand;
  locale: Locale;
}) {
  const t = useT();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = usePanelChrome();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    // pointerdown, not click: a click listener fires after the target's own
    // handler, so tapping the button that opened the menu would close and
    // immediately reopen it.
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  const roleLabel =
    accountType === "company"
      ? t("panel.roleAdmin")
      : accountType === "agent"
        ? t("panel.roleAgent")
        : t("panel.roleCustomer");

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-3 sm:px-4">
      {/* Mobile: opens the drawer. Desktop: collapses the rail. One button in one
          place, because to the reader it is the same control — "the sidebar". */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? t("panel.closeMenu") : t("panel.openMenu")}
        aria-expanded={mobileOpen}
        className="rounded-lg p-2.5 text-[var(--muted)] hover:bg-[var(--background)] hover:text-foreground md:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? t("panel.expandSidebar") : t("panel.collapseSidebar")}
        title={collapsed ? t("panel.expandSidebar") : t("panel.collapseSidebar")}
        aria-pressed={collapsed}
        className="hidden rounded-lg p-2.5 text-[var(--muted)] hover:bg-[var(--background)] hover:text-foreground md:inline-flex"
      >
        <SidebarIcon className="h-5 w-5" collapsed={collapsed} />
      </button>

      {/* The brand only on phones — on desktop it is already at the top of the
          sidebar, and printing it twice on one screen reads as a mistake. */}
      <Link href="/panel" className="flex items-center md:hidden">
        <SiteLogo brand={brand} imgClassName="h-7 w-auto max-w-[140px]" markClassName="h-6 w-6" />
      </Link>

      <div className="ml-auto flex items-center" ref={menuRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t("panel.accountMenu")}
            className={`flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-[var(--background)] ${
              menuOpen ? "bg-[var(--background)]" : ""
            }`}
          >
            <Avatar displayName={displayName} avatarUrl={avatarUrl} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label={t("panel.accountMenu")}
              className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg"
            >
              {/* Who you are, and the way to edit it. The whole block is the link:
                  a separate "view profile" row underneath was the redundant thing
                  the sidebar carried for months. */}
              <Link
                href="/panel/profile"
                // Closed here rather than by watching the pathname: this is the
                // one control in the menu that navigates, and a setState in a
                // route-change effect is a cascading render.
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 border-b border-[var(--border)] px-3 py-3 transition-colors hover:bg-[var(--background)]"
              >
                <Avatar displayName={displayName} avatarUrl={avatarUrl} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium leading-tight text-foreground">
                    {displayName}
                  </span>
                  {email && (
                    <span className="block truncate text-xs leading-tight text-[var(--muted)]">
                      {email}
                    </span>
                  )}
                  <span className="mt-0.5 inline-block rounded bg-[var(--accent-subtle)] px-1.5 text-[0.6875rem] font-medium leading-relaxed text-[var(--primary)]">
                    {roleLabel}
                  </span>
                </span>
              </Link>

              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm text-[var(--muted)]">{t("nav.language")}</span>
                <LanguageSwitcher current={locale} label={t("nav.language")} />
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
                <span className="text-sm text-[var(--muted)]">{t("panel.themeLabel")}</span>
                <ThemeSwitch />
              </div>

              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 px-3 py-3 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-red-600"
                >
                  <LogoutIcon className="h-5 w-5 shrink-0" />
                  {t("panel.signOut")}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Avatar({ displayName, avatarUrl }: { displayName: string; avatarUrl: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-subtle)] text-xs font-semibold uppercase text-[var(--primary)]">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        displayName.trim().charAt(0) || "?"
      )}
    </span>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/** A panel with its side rail — filled when the rail is showing, hollow when not. */
function SidebarIcon({ className, collapsed }: { className?: string; collapsed: boolean }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={2} />
      <path strokeWidth={2} d="M9 4v16" />
      {!collapsed && <path strokeWidth={2} d="M3 4h6v16H3z" fill="currentColor" opacity="0.25" />}
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
