"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { ThemeSwitch } from "@/components/theme-switch";
import { AssetLibraryModal } from "@/components/asset-library-modal";
import { BrandMark } from "@/components/brand-mark";
import type { FeatureKey } from "@/lib/features";

type Role = "admin" | "customer" | "publisher";
type Props = { role?: Role; canSell?: boolean; displayName?: string; pendingActions?: number; features?: FeatureKey[] };

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutIcon;
  feature?: FeatureKey;
  external?: boolean;
  everyone?: boolean;
  sellerOnly?: boolean;
  publisherToo?: boolean;
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Produk",
    items: [
      { href: "/panel/purchases", label: "Pembelian saya", icon: ReceiptIcon, everyone: true },
      { href: "/panel/products", label: "Produk digital", icon: LayoutIcon, sellerOnly: true },
      { href: "/panel/stats", label: "Stats", icon: ChartIcon, feature: "stats", publisherToo: true },
    ],
  },
  {
    label: "Lainnya",
    items: [
      { href: "/panel/contacts", label: "Kontak", icon: MailIcon, feature: "contacts" },
      { href: "/panel/inbox", label: "Email masuk", icon: InboxIcon, feature: "inbox" },
      { href: "/panel/users", label: "Users", icon: UsersIcon, feature: "users" },
      { href: "/panel/categories", label: "Kategori", icon: TagIcon, feature: "categories" },
      { href: "/panel/hero", label: "Hero", icon: HeroIcon, feature: "hero" },
      { href: "/panel/content", label: "Konten situs", icon: DocIcon, feature: "content" },
      { href: "/panel/custom-js", label: "Custom JS", icon: CodeIcon, feature: "custom-js" },
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
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
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
function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}
function HeroIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 5v9a2 2 0 002 2h5m-7-11v0m9 3l3 3m0 0l3-3m-3 3V9m0 12v-5" />
    </svg>
  );
}
function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}
function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}
function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  );
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
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
function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function NavContent({
  role,
  features = [],
  canSell,
  pendingActions = 0,
  onItemClick,
  onOpenAssets,
}: {
  role?: Role;
  features?: FeatureKey[];
  canSell?: boolean;
  pendingActions?: number;
  onItemClick?: () => void;
  onOpenAssets?: () => void;
}) {
  const pathname = usePathname();

  const isVisible = (item: NavItem) => {
    if (item.everyone) return true;
    if (item.sellerOnly) return !!canSell;
    if (item.feature) return features.includes(item.feature) || (!!item.publisherToo && role === "publisher");
    return true;
  };

  return (
    <>
      <nav className="flex flex-col gap-6 py-4">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(isVisible);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) => {
                  const active = !item.external && (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
                  const Icon = item.icon;
                  const linkClass = `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-[var(--accent-subtle)] text-[var(--primary)] font-medium"
                      : "text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)]"
                  }`;
                  const badgeCount = item.href === "/panel/users" ? pendingActions : 0;
                  const content = (
                    <>
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                      {badgeCount > 0 && (
                        <span
                          className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white"
                          title={`${badgeCount} tindakan menunggu`}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </>
                  );
                  return item.external ? (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onItemClick}
                      className={linkClass}
                    >
                      {content}
                    </a>
                  ) : (
                    <Link key={item.href} href={item.href} onClick={onItemClick} className={linkClass}>
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {canSell && onOpenAssets && (
          <div>
            <p className="px-3 mb-1.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
              Media
            </p>
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => {
                  onOpenAssets();
                  onItemClick?.();
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
              >
                <ImageIcon className="w-5 h-5 shrink-0" />
                <span>Assets</span>
              </button>
            </div>
          </div>
        )}
      </nav>
      <div className="mt-auto pt-4 border-t border-[var(--border)] flex items-center gap-2">
        <Link
          href="/"
          onClick={onItemClick}
          className="flex flex-1 items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
        >
          <HomeIcon className="w-5 h-5 shrink-0" />
          <span>View home</span>
        </Link>
        <form action={signOut} className="flex-1">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
          >
            <LogoutIcon className="w-5 h-5 shrink-0" />
            <span>Keluar</span>
          </button>
        </form>
      </div>
    </>
  );
}

export function PanelSidebar({ role, canSell, displayName, pendingActions, features }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);

  return (
    <>
      {/* Mobile: top bar with menu button */}
      <div className="md:hidden sticky top-0 z-20 flex items-center justify-between h-14 px-4 border-b border-[var(--border)] bg-[var(--card)]">
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="relative p-2 -ml-2 rounded-lg text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
          {!mobileOpen && !!pendingActions && pendingActions > 0 && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-[var(--card)]" aria-hidden />
          )}
        </button>
        <div className="flex items-center gap-0.5">
          <ThemeSwitch />
          <button
            type="button"
            aria-label="Notifikasi"
            className="p-2 rounded-lg text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)]"
          >
            <BellIcon className="w-5 h-5" />
          </button>
        </div>
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
        <div className="flex h-14 items-center justify-between px-4 border-b border-[var(--border)] md:border-0">
          <Link href="/panel" className="flex items-center gap-2 text-base font-semibold text-foreground" onClick={() => setMobileOpen(false)}>
            <BrandMark className="h-6 w-6" />
            ADM.UIUX
          </Link>
          <div className="hidden md:flex items-center gap-0.5">
            <ThemeSwitch />
            <button
              type="button"
              aria-label="Notifikasi"
              className="p-2 rounded-lg text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)]"
            >
              <BellIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        {displayName && (
          <div className="px-4 pb-2">
            <p className="text-xs text-[var(--muted)]">Halo, <span className="font-medium text-foreground">{displayName}</span></p>
            <Link href="/panel/profile" className="text-xs font-medium text-[var(--primary)] hover:underline" onClick={() => setMobileOpen(false)}>
              View Profile
            </Link>
          </div>
        )}
        <div className="flex flex-1 flex-col overflow-y-auto px-3">
          <NavContent
            role={role}
            features={features}
            canSell={canSell}
            pendingActions={pendingActions}
            onItemClick={() => setMobileOpen(false)}
            onOpenAssets={() => setAssetsOpen(true)}
          />
        </div>
      </aside>

      {/* Spacer for desktop: takes space so main content is beside sidebar */}
      <div className="hidden md:block w-56 shrink-0" aria-hidden />

      <AssetLibraryModal open={assetsOpen} onClose={() => setAssetsOpen(false)} />
    </>
  );
}
