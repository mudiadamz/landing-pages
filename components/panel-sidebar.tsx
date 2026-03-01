"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { ThemeSwitch } from "@/components/theme-switch";

type Props = { isAdmin: boolean };

const navGroups: { label: string; items: { href: string; label: string; icon: typeof LayoutIcon; adminOnly?: boolean }[] }[] = [
  {
    label: "Landing page",
    items: [{ href: "/panel", label: "Landing pages", icon: LayoutIcon }],
  },
  {
    label: "Lainnya",
    items: [
      { href: "/panel/dashboard", label: "Dashboard", icon: ChartIcon, adminOnly: true },
      { href: "/panel/contacts", label: "Kontak", icon: MailIcon, adminOnly: true },
    ],
  },
];

function LayoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  );
}
function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

function NavContent({ isAdmin, onItemClick }: { isAdmin: boolean; onItemClick?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex flex-col gap-6 py-4">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) => {
                  const active = pathname === item.href || (item.href !== "/panel" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onItemClick}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        active
                          ? "bg-[var(--accent-subtle)] text-[var(--primary)] font-medium"
                          : "text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)]"
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.href === "/panel" ? (isAdmin ? "Landing pages" : "Pembelian saya") : item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <ThemeSwitch />
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
          >
            <LogoutIcon className="w-5 h-5 shrink-0" />
            <span>Keluar</span>
          </button>
        </form>
      </div>
    </>
  );
}

export function PanelSidebar({ isAdmin }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile: top bar with menu button */}
      <div className="md:hidden sticky top-0 z-20 flex items-center justify-between h-14 px-4 border-b border-[var(--border)] bg-[var(--card)]">
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 -ml-2 rounded-lg text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <span className="text-sm font-medium text-foreground">Panel</span>
        <div className="w-9" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar: desktop fixed, mobile as drawer */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-56 flex flex-col border-r border-[var(--border)] bg-[var(--card)] transition-transform duration-200 ease-out md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center px-4 border-b border-[var(--border)] md:border-0">
          <Link href="/panel" className="text-base font-semibold text-foreground" onClick={() => setMobileOpen(false)}>
            ADM.UIUX
          </Link>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-3">
          <NavContent isAdmin={isAdmin} onItemClick={() => setMobileOpen(false)} />
        </div>
      </aside>

      {/* Spacer for desktop: takes space so main content is beside sidebar */}
      <div className="hidden md:block w-56 shrink-0" aria-hidden />
    </>
  );
}
