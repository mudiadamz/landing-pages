import Link from "next/link";

type Tab = "home" | "categories" | "profile";

/**
 * Fixed bottom navigation shown on small screens for the public site: Beranda,
 * Kategori, and Profil (or Masuk when logged out). Includes an in-flow spacer so
 * page content/footer isn't hidden behind the fixed bar. Hidden on md+.
 */
export function MobileBottomNav({
  isLoggedIn,
  active,
}: {
  isLoggedIn: boolean;
  active?: Tab;
}) {
  const items: { key: Tab; href: string; label: string; icon: React.ReactNode }[] = [
    { key: "home", href: "/", label: "Beranda", icon: <HomeIcon /> },
    { key: "categories", href: "/categories", label: "Kategori", icon: <GridIcon /> },
    {
      key: "profile",
      href: isLoggedIn ? "/panel" : "/login",
      label: isLoggedIn ? "Profil" : "Masuk",
      icon: <UserIcon />,
    },
  ];

  return (
    <>
      {/* Reserve space so the fixed bar never covers the footer. */}
      <div className="h-16 md:hidden" aria-hidden />
      <nav
        aria-label="Navigasi bawah"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--card)]/80 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto flex max-w-5xl items-stretch">
          {items.map((it) => {
            const isActive = active === it.key;
            return (
              <Link
                key={it.key}
                href={it.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors active:opacity-70 ${
                  isActive ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-foreground"
                }`}
              >
                {it.icon}
                <span>{it.label}</span>
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
