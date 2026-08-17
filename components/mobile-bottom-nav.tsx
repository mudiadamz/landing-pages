"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Tab = "home" | "categories" | "profile";

/** Short buzz on tap where the browser supports it (Android Chrome; no-op on iOS). */
function buzz() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(8);
  }
}

/**
 * Fixed bottom navigation shown on small screens for the public site: Beranda,
 * Kategori, and Profil (or Masuk when logged out). Mounted once via SiteFooter,
 * so every page with the public shell gets it; /lp and /panel have their own
 * chrome and never render the footer. Includes an in-flow spacer so the footer
 * isn't hidden behind the fixed bar. Hidden on md+.
 */
export function MobileBottomNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useT();
  const pathname = usePathname() ?? "/";

  const items: {
    key: Tab;
    href: string;
    label: string;
    icon: React.ReactNode;
    match: (p: string) => boolean;
  }[] = [
    { key: "home", href: "/", label: t("nav.home"), icon: <HomeIcon />, match: (p) => p === "/" },
    {
      key: "categories",
      href: "/categories",
      label: t("panel.navCategories"),
      icon: <GridIcon />,
      match: (p) => p === "/categories" || p.startsWith("/category/"),
    },
    {
      key: "profile",
      href: isLoggedIn ? "/panel" : "/login",
      label: isLoggedIn ? t("nav.profile") : t("nav.signIn"),
      icon: <UserIcon />,
      match: (p) => p.startsWith("/panel") || p === "/login" || p === "/signup",
    },
  ];

  const routeTab = items.find((it) => it.match(pathname))?.key ?? null;

  // Optimistic highlight: the tapped tab lights up right away instead of waiting
  // for the server render, so the bar reacts even on a slow navigation. Tagged
  // with the path it was tapped from, so it self-expires once we've navigated.
  const [pending, setPending] = useState<{ tab: Tab; from: string } | null>(null);
  const active = pending && pending.from === pathname ? pending.tab : routeTab;
  const activeIndex = items.findIndex((it) => it.key === active);

  return (
    <>
      {/* Reserve space so the fixed bar never covers the footer. */}
      <div className="h-[4.5rem] md:hidden" aria-hidden />
      <nav
        aria-label={t("home.bottomNav")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--card)]/80 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="relative mx-auto flex max-w-5xl items-stretch">
          {/* Indicator that slides between tabs; hidden on pages that map to no tab. */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 flex justify-center transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: `${100 / items.length}%`,
              transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
              opacity: activeIndex < 0 ? 0 : 1,
            }}
          >
            <span className="h-0.5 w-8 rounded-full bg-[var(--primary)]" />
          </span>

          {items.map((it) => {
            const isActive = active === it.key;
            return (
              <Link
                key={it.key}
                href={it.href}
                onPointerDown={buzz}
                onClick={() => setPending({ tab: it.key, from: pathname })}
                aria-current={isActive ? "page" : undefined}
                className={`group flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-foreground"
                }`}
              >
                <span className="flex flex-col items-center gap-0.5 transition-transform duration-100 ease-out group-active:scale-90 motion-reduce:transition-none">
                  <span className="relative flex h-8 w-16 items-center justify-center">
                    {/* Pill sits behind the icon: always on for the active tab,
                        and blooms under the thumb on press for the others. */}
                    <span
                      aria-hidden
                      className={`absolute inset-0 rounded-full bg-[var(--accent-subtle)] transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
                        isActive
                          ? "scale-100 opacity-100"
                          : "scale-75 opacity-0 group-active:scale-100 group-active:opacity-70 group-active:duration-150"
                      }`}
                    />
                    <span
                      className={`relative transition-transform duration-300 ease-out motion-reduce:transition-none ${
                        isActive ? "-translate-y-px scale-110" : "scale-100"
                      }`}
                    >
                      {it.icon}
                    </span>
                  </span>
                  <span>{it.label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function HomeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zM14 4h6v6h-6V4zM4 14h6v6H4v-6zM14 14h6v6h-6v-6z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" />
    </svg>
  );
}
