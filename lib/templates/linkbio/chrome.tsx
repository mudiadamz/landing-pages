import Link from "next/link";
import { currentSite } from "@/lib/site-resolve";
import { getPublishedPages } from "@/lib/actions/pages";
import { SiteLogo } from "@/components/site-logo";
import type { ChromeProps } from "../registry";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * Chrome for the link-in-bio theme — deliberately almost nothing.
 *
 * The homepage renders NO header at all (see LinkbioHome): a bio card with a nav
 * bar above it stops being a bio card. But the secondary pages a link can lead to
 * — checkout, legal, a category — still need a way back, so they get a single
 * centred wordmark. Anything more would reintroduce the marketplace furniture the
 * theme exists to avoid.
 */
export function LinkbioHeader({ user, brand }: ChromeProps) {
  const t = translator(brand.locale);
  return (
    <header className="bg-[var(--accent-subtle)]/40">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-5 py-3.5">
        <Link
          href="/"
          aria-label={brand.name}
          className="truncate text-sm font-semibold tracking-tight text-foreground transition-opacity hover:opacity-70"
        >
          <SiteLogo
            brand={brand}
            imgClassName="h-6 w-auto max-w-[140px]"
            markClassName="h-5 w-5"
          />
        </Link>
        <Link
          href={user ? "/panel/purchases" : "/login"}
          className="shrink-0 text-xs text-[var(--muted)] transition-colors hover:text-foreground"
        >
          {user ? t("nav.myPurchases") : t("nav.signIn")}
        </Link>
      </div>
    </header>
  );
}

/** One line. A link-in-bio page has a colophon, not a sitemap. */
export async function LinkbioFooter() {
  const [site, pages, locale] = await Promise.all([
    currentSite(),
    getPublishedPages(),
    requestLocale(),
  ]);
  const t = translator(locale);
  return (
    <footer className="mt-10 shrink-0 bg-[var(--accent-subtle)]/40">
      <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-5 py-7 text-xs text-[var(--muted)]">
        <span>
          © {new Date().getFullYear()} {site.name}
        </span>
        {/* Tentang and Kontak first: they are what a visitor is looking for,
            and the legal three are what they are required to be able to find. */}
        <Link href="/about" className="transition-colors hover:text-foreground">
          {t("nav.about")}
        </Link>
        <Link href="/contact" className="transition-colors hover:text-foreground">
          {t("nav.contact")}
        </Link>
        {/* Whatever the storefront has written. Between the two fixed pages and
            the legal three, because that is the order of how likely a visitor is
            to want them. */}
        {pages.map((p) => (
          <Link key={p.id} href={`/p/${p.slug}`} className="transition-colors hover:text-foreground">
            {p.title}
          </Link>
        ))}
        <Link href="/privacy" className="transition-colors hover:text-foreground">
          {t("nav.privacy")}
        </Link>
        <Link href="/terms" className="transition-colors hover:text-foreground">
          {t("nav.terms")}
        </Link>
        <Link href="/refund" className="transition-colors hover:text-foreground">
          {t("nav.refund")}
        </Link>
        <LanguageSwitcher current={locale} label={t("nav.language")} />
      </div>
    </footer>
  );
}
