"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { ThemeSwitch } from "@/components/theme-switch";
import { AssetLibraryModal } from "@/components/asset-library-modal";
import { SiteLogo } from "@/components/site-logo";
import { PanelSiteSwitcher } from "@/components/panel-site-switcher";
import type { PanelSiteOption } from "@/lib/panel-site";
import type { SiteBrand } from "@/lib/site-brand";
import type { FeatureKey } from "@/lib/features";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useT } from "@/lib/i18n/client";
import type { Locale, MessageKey } from "@/lib/i18n";

type Role = "admin" | "customer" | "publisher";
type Props = {
  role?: Role;
  canSell?: boolean;
  displayName?: string;
  /** Their picture, or empty — the initial letter is the fallback. */
  avatarUrl?: string;
  pendingActions?: number;
  features?: FeatureKey[];
  /** Empty for non-admins: the scope only drives admin screens. */
  sites?: PanelSiteOption[];
  editingSiteId?: string;
  /**
   * The storefront this panel is being SERVED on — not the one the switcher below
   * is editing. A buyer opens "Pembelian saya" on the domain they bought from
   * (sessions don't cross domains), so the shell has to wear that domain's name.
   * It said ADM.UIUX everywhere, which on a niche storefront is a stranger's brand.
   */
  brand: SiteBrand;
  /** Panel language, resolved per request; shared with the storefront. */
  locale: Locale;
};

type NavItem = {
  href: string;
  labelKey: MessageKey;
  icon: typeof LayoutIcon;
  feature?: FeatureKey;
  external?: boolean;
  everyone?: boolean;
  sellerOnly?: boolean;
  publisherToo?: boolean;
  adminOnly?: boolean;
  /** Match the path exactly — for /panel, which is a prefix of every other route. */
  exact?: boolean;
  /** Opens a popup instead of navigating. */
  action?: "assets";
};

/**
 * Six small groups by what you came to do, rather than two plus a bin.
 *
 * "Lainnya" used to hold eleven unrelated things — inbox next to Roles next to
 * Custom JS — which is the shape a nav takes when items are appended as they're
 * built. Anything past about five entries in one list stops being scanned and
 * starts being searched, and an admin here has every one of them.
 *
 * Assets is a real entry now instead of a special case rendered outside the
 * loop, and /panel itself finally appears: it was reachable only by clicking the
 * logo, which is not a thing most people try.
 */
const navGroups: { labelKey: MessageKey; items: NavItem[] }[] = [
  {
    labelKey: "panel.navGroupMain",
    items: [
      { href: "/panel", labelKey: "panel.navDashboard", icon: HomeIcon, everyone: true, exact: true },
      { href: "/panel/purchases", labelKey: "panel.navPurchases", icon: ReceiptIcon, everyone: true },
      { href: "/panel/favorites", labelKey: "panel.navFavorites", icon: HeartIcon, everyone: true },
    ],
  },
  {
    // Everything you touch to sell something, in the order you touch it.
    labelKey: "panel.navGroupSelling",
    items: [
      { href: "/panel/products", labelKey: "panel.navProducts", icon: LayoutIcon, sellerOnly: true },
      { href: "#assets", labelKey: "panel.navAssets", icon: ImageIcon, sellerOnly: true, action: "assets" },
      { href: "/panel/sales", labelKey: "panel.navSales", icon: ChartIcon, feature: "stats", publisherToo: true },
    ],
  },
  {
    labelKey: "panel.navGroupUsers",
    items: [
      { href: "/panel/users", labelKey: "panel.navUsers", icon: UsersIcon, feature: "users" },
      { href: "/panel/roles", labelKey: "panel.navRoles", icon: ShieldIcon, adminOnly: true },
    ],
  },
  {
    labelKey: "panel.navGroupMessages",
    items: [
      { href: "/panel/contacts", labelKey: "panel.navContacts", icon: MailIcon, feature: "contacts" },
      { href: "/panel/inbox", labelKey: "panel.navInbox", icon: InboxIcon, feature: "inbox" },
    ],
  },
  {
    labelKey: "panel.navGroupSite",
    items: [
      { href: "/panel/sites", labelKey: "panel.navDomains", icon: GlobeIcon, adminOnly: true },
      // Directly after Domain: same object, opposite half. Domain is the plumbing
      // (hostname, Vercel, on/off), this is the content (name, logo, template, niche).
      { href: "/panel/branding", labelKey: "panel.navBranding", icon: BadgeIcon, adminOnly: true },
      { href: "/panel/categories", labelKey: "panel.navCategories", icon: TagIcon, feature: "categories" },
      { href: "/panel/hero", labelKey: "panel.navHero", icon: HeroIcon, feature: "hero" },
      { href: "/panel/content", labelKey: "panel.navContent", icon: DocIcon, feature: "content" },
      // Beside Konten situs: same job, different surface — that one is homepage
      // copy, this one is the three pages with fixed URLs.
      { href: "/panel/legal", labelKey: "panel.navLegal", icon: DocIcon, feature: "legal" },
      { href: "/panel/hiring", labelKey: "panel.navHiring", icon: BadgeIcon, feature: "hiring" },
      // Other places the owner exists, not other storefronts this app serves —
      // those are "Domain" above.
      { href: "/panel/pages", labelKey: "panel.navPages", icon: PageIcon, adminOnly: true },
      { href: "/panel/links", labelKey: "panel.navLinks", icon: ChainIcon, adminOnly: true },
    ],
  },
  {
    // Measurement and plumbing — rarely opened, so it sits last.
    labelKey: "panel.navGroupSystem",
    items: [
      { href: "/panel/appearance", labelKey: "panel.navAppearance", icon: PaletteIcon, adminOnly: true },
      { href: "/panel/analytics", labelKey: "panel.navAnalytics", icon: PulseIcon, adminOnly: true },
      { href: "/panel/tracking", labelKey: "panel.navTracking", icon: TargetIcon, adminOnly: true },
      { href: "/panel/custom-js", labelKey: "panel.navCustomJs", icon: CodeIcon, feature: "custom-js" },
      { href: "/panel/popup", labelKey: "panel.navPopup", icon: PopupIcon, adminOnly: true },
      { href: "/panel/storage", labelKey: "panel.navStorage", icon: DatabaseIcon, adminOnly: true },
    ],
  },
];

/* A rosette: a mark applied to a thing, which is what a storefront's identity is.
 * Deliberately unlike GlobeIcon next to it — the two rows edit the same object and
 * a similar glyph would make them read as one screen split in half by accident. */
function BadgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="9" r="6" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.5 14.2L7 22l5-2.5 5 2.5-1.5-7.8" />
    </svg>
  );
}

/* A small card layered over a larger one — the popup sitting over the preview.
 * Its own glyph rather than the TargetIcon it used to share with Tracking, which
 * made two unrelated rows look like the same tool. */
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" />
    </svg>
  );
}
function PopupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h11a1 1 0 011 1v4M4 5a1 1 0 00-1 1v9a1 1 0 001 1h4" />
      <rect x="10" y="11" width="11" height="8" rx="1.5" strokeWidth={2} />
    </svg>
  );
}
function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828L11 19.5M7 17h.01" />
    </svg>
  );
}
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}
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
function PageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4h7l4 4v12a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 4v5h5M9 13h6M9 16h4" />
    </svg>
  );
}

function ChainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 13.5a4 4 0 005.66 0l3-3a4 4 0 10-5.66-5.66l-1 1" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 10.5a4 4 0 00-5.66 0l-3 3a4 4 0 105.66 5.66l1-1" />
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
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7c0 1.657 3.582 3 8 3s8-1.343 8-3-3.582-3-8-3-8 1.343-8 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v5c0 1.657 3.582 3 8 3s8-1.343 8-3V7M4 12v5c0 1.657 3.582 3 8 3s8-1.343 8-3v-5" />
    </svg>
  );
}
function PulseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l3 8 4-16 3 8h4" />
    </svg>
  );
}
function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12m-9 0a9 9 0 1018 0 9 9 0 10-18 0" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12m-5 0a5 5 0 1010 0 5 5 0 10-10 0M12 12m-1 0a1 1 0 102 0 1 1 0 10-2 0" />
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
  const t = useT();
  const pathname = usePathname();

  const isVisible = (item: NavItem) => {
    if (item.everyone) return true;
    if (item.adminOnly) return role === "admin";
    if (item.sellerOnly) return !!canSell;
    if (item.feature) return features.includes(item.feature) || (!!item.publisherToo && role === "publisher");
    return true;
  };

  return (
    <>
      <nav aria-label={t("panel.menu")} className="flex flex-col gap-5 py-3">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(isVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.labelKey}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]/70">
                {t(group.labelKey)}
              </p>
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) => {
                  // Exact for /panel — as a prefix it would light up on every page.
                  // Elsewhere the trailing slash keeps /panel/product off /panel/products.
                  const active =
                    !item.action &&
                    !item.external &&
                    (item.exact
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(`${item.href}/`));
                  const Icon = item.icon;
                  // Roomier rows on touch, where the drawer has space to spare and
                  // a thumb is a blunter instrument than a cursor.
                  const linkClass = `flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] transition-colors md:py-2.5 md:text-sm ${
                    active
                      ? "bg-[var(--accent-subtle)] font-medium text-[var(--primary)]"
                      : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-foreground"
                  }`;
                  const badgeCount = item.href === "/panel/users" ? pendingActions : 0;
                  const content = (
                    <>
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{t(item.labelKey)}</span>
                      {badgeCount > 0 && (
                        <span
                          className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white"
                          title={t("panel.pendingActions", { count: badgeCount })}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </>
                  );

                  if (item.action === "assets") {
                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => {
                          onOpenAssets?.();
                          onItemClick?.();
                        }}
                        className={linkClass}
                      >
                        {content}
                      </button>
                    );
                  }

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
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onItemClick}
                      aria-current={active ? "page" : undefined}
                      className={linkClass}
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t border-[var(--border)] pt-3">
        <Link
          href="/"
          onClick={onItemClick}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-3 text-[15px] text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground md:py-2.5 md:text-sm"
        >
          <HomeIcon className="h-5 w-5 shrink-0" />
          <span>{t("panel.viewSite")}</span>
        </Link>
        <form action={signOut} className="flex-1">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-3 text-[15px] text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground md:py-2.5 md:text-sm"
          >
            <LogoutIcon className="h-5 w-5 shrink-0" />
            <span>Keluar</span>
          </button>
        </form>
      </div>
    </>
  );
}

export function PanelSidebar({
  role,
  canSell,
  displayName,
  avatarUrl = "",
  pendingActions,
  features,
  sites = [],
  editingSiteId = "",
  brand,
  locale,
}: Props) {
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const close = () => setMobileOpen(false);

  // Escape closes the drawer, and the page behind it stops scrolling while it is
  // open — without that, dragging the drawer scrolls the content underneath and
  // you return to a page that has moved.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile: top bar with menu button */}
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-3 md:hidden">
        <button
          type="button"
          aria-label={mobileOpen ? t("panel.closeMenu") : t("panel.openMenu")}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="relative rounded-lg p-2.5 text-[var(--muted)] hover:bg-[var(--background)] hover:text-foreground"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
          {!mobileOpen && !!pendingActions && pendingActions > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-[var(--card)]" aria-hidden />
          )}
        </button>
        <Link href="/panel" className="flex items-center text-base font-semibold text-foreground">
          <SiteLogo brand={brand} imgClassName="h-7 w-auto max-w-[150px]" markClassName="h-6 w-6" />
        </Link>
        <ThemeSwitch />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={close}
          aria-hidden
        />
      )}

      {/* Sidebar: desktop fixed, mobile as drawer.
          Wider on mobile — a 224px drawer left long labels truncating against a
          strip of dimmed page nobody was going to read. */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-[86vw] max-w-sm flex-col border-r border-[var(--border)] bg-[var(--card)] transition-transform duration-200 ease-out md:w-64 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-4 md:border-0">
          <Link href="/panel" className="flex items-center text-base font-semibold text-foreground" onClick={close}>
            <SiteLogo brand={brand} imgClassName="h-7 w-auto max-w-[150px]" markClassName="h-6 w-6" />
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label={t("panel.closeMenu")}
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--background)] hover:text-foreground md:hidden"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Identity and the two preference controls on ONE row.
            They were three stacked blocks — a bordered profile card, a language
            row, a theme toggle in the header — which on a short screen pushed
            the nav itself below the fold. None of them is the reason anyone
            opens this sidebar, so none of them gets its own line.

            The avatar and name stay a single large tap target to /panel/profile;
            the role moved under the name where the redundant "Lihat profil"
            used to sit. */}
        <div className="mx-3 mt-3 flex shrink-0 items-center gap-2">
          {/* The row renders even without a display name: the theme and
              language controls live here now, and a profile that has not been
              filled in must not take them off the screen. */}
          {displayName ? (
            <Link
              href="/panel/profile"
              onClick={close}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 transition-colors hover:opacity-80"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-subtle)] text-xs font-semibold uppercase text-[var(--primary)]">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  displayName.trim().charAt(0) || "?"
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium leading-tight text-foreground">
                  {displayName}
                </span>
                <span className="block truncate text-[11px] leading-tight text-[var(--muted)]">
                  {role === "admin"
                    ? t("panel.roleAdmin")
                    : role === "publisher"
                      ? t("panel.rolePublisher")
                      : t("panel.roleCustomer")}
                </span>
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          <LanguageSwitcher current={locale} label={t("nav.language")} />
          <ThemeSwitch />
        </div>

        {/* The one site switcher. Directly under the profile card so it reads as
            "who I am / what I'm working on", above the nav it changes the meaning of. */}
        <PanelSiteSwitcher sites={sites} currentId={editingSiteId} onChanged={close} />

        <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-[env(safe-area-inset-bottom)]">
          <NavContent
            role={role}
            features={features}
            canSell={canSell}
            pendingActions={pendingActions}
            onItemClick={close}
            onOpenAssets={() => setAssetsOpen(true)}
          />
        </div>
      </aside>

      {/* Spacer for desktop: takes space so main content is beside sidebar */}
      <div className="hidden w-64 shrink-0 md:block" aria-hidden />

      <AssetLibraryModal open={assetsOpen} onClose={() => setAssetsOpen(false)} />
    </>
  );
}
