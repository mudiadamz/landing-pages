import Link from "next/link";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { createClient } from "@/lib/db/server";
import { currentSite } from "@/lib/site-resolve";
import { LanguageSwitcher } from "@/components/language-switcher";
import { requestLocale } from "@/lib/i18n/request";
import { t } from "@/lib/i18n";

/**
 * A colophon, not a sitemap.
 *
 * The shared footer ends with a hardcoded "© ADM.UIUX", which is simply wrong on a
 * storefront that isn't ADM.UIUX — this one uses the site's own name. It also drops
 * the social row and the Hiring link: both belong to the parent brand, not to a
 * niche shop, and Hiring in particular is an odd thing to advertise on a bookshelf.
 *
 * The legal links stay. They are obligations, not decoration, and the pages exist
 * on every domain.
 */
export async function PustakaFooter() {
  const [site, db, locale] = await Promise.all([
    currentSite(),
    createClient(),
    requestLocale(),
  ]);
  const {
    data: { user },
  } = await db.auth.getUser();

  const links: [string, string][] = [
    ["/", "Beranda"],
    ["/categories", "Semua kategori"],
    ["/about", "Tentang"],
    ["/contact", "Kontak"],
    ["/privacy", "Privasi"],
    ["/terms", "Ketentuan"],
    ["/refund", "Pengembalian dana"],
  ];

  return (
    <>
      <footer className="mt-8 shrink-0 border-t border-[var(--border)]">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <p className="font-[family-name:var(--font-auman)] text-base text-foreground">
            {site.name}
          </p>
          {site.tagline && (
            <p className="mt-1 max-w-md text-sm text-[var(--muted)]">{site.tagline}</p>
          )}

          <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="py-1 text-[var(--muted)] transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5 text-xs text-[var(--muted)]">
            <p>
              © {new Date().getFullYear()} {site.name} · Pembayaran via QRIS &amp; e-wallet
            </p>
            <LanguageSwitcher current={locale} label={t("nav.language", undefined, locale)} />
          </div>
        </div>
      </footer>
      {/* Kept: the bottom nav is how phone visitors reach their purchases, and that
          is a product concern rather than a styling one. */}
      <MobileBottomNav isLoggedIn={!!user} />
    </>
  );
}
