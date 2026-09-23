"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

/**
 * Navigation for the CUSTOMER panel — four places, not twenty-six.
 *
 * Someone who only ever buys reaches exactly four screens. Rendering those into
 * a collapsible full-height rail built for an admin's twenty-six was the panel
 * telling every buyer they had wandered into the back office. So the shell
 * splits (see components/account-shell.tsx) and this is its nav: a tab row on
 * desktop, a bottom bar on phones, one list of items behind both.
 *
 * The items are deliberately NOT derived from the sidebar's `navGroups`. That
 * list is shaped by permissions — `feature`, `sellerOnly`, `platformOnly` — and
 * a customer has none of them; filtering it down would leave four entries and a
 * lot of machinery explaining why the other twenty-two are missing.
 */

type Item = {
  href: string;
  labelKey: MessageKey;
  icon: (p: { className?: string }) => React.ReactElement;
  /** Match the path exactly — /panel is a prefix of every other route here. */
  exact?: boolean;
};

const ITEMS: Item[] = [
  { href: "/panel", labelKey: "panel.navOverview", icon: HomeIcon, exact: true },
  { href: "/panel/purchases", labelKey: "panel.navPurchases", icon: ReceiptIcon },
  { href: "/panel/favorites", labelKey: "panel.navFavorites", icon: HeartIcon },
  { href: "/panel/profile", labelKey: "nav.profile", icon: UserIcon },
];

function useActive() {
  const pathname = usePathname() ?? "/panel";
  return (item: Item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Desktop & tablet: a tab row under the page heading. Hidden on phones. */
export function AccountTabs() {
  const t = useT();
  const isActive = useActive();

  return (
    <nav
      aria-label={t("panel.accountNav")}
      className="hidden border-b border-[var(--border)] sm:block"
    >
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Phones: a fixed bottom bar, the same four items.
 *
 * Fixed rather than in-flow, so it survives a long purchase list; the shell
 * pads the main column by the same height plus the safe-area inset, because a
 * bar that covers the last row of content is worse than no bar.
 */
export function AccountBottomNav() {
  const t = useT();
  const isActive = useActive();

  return (
    <nav
      aria-label={t("panel.accountNav")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)] pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="flex">
        {ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={buzz}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[0.6875rem] font-medium transition-colors ${
                  active ? "text-[var(--primary)]" : "text-[var(--muted)]"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="truncate">{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Short buzz on tap where the browser supports it (Android Chrome; no-op on iOS). */
function buzz() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(8);
  }
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
    </svg>
  );
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14h6m-6-4h6m-8 10l2-1 2 1 2-1 2 1 2-1 2 1V5a2 2 0 00-2-2H7a2 2 0 00-2 2v15z" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
