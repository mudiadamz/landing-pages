import Link from "next/link";
import { currentSite } from "@/lib/site-resolve";
import { SiteLogo } from "@/components/site-logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { LanguageSwitcher } from "@/components/language-switcher";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import type { ChromeProps } from "../registry";

/**
 * Chrome for the chat theme — a slim line, and only where it is needed.
 *
 * The homepage renders NONE of this (see MbahgptHome): the chat owns the full
 * viewport and has its own sidebar, and a nav bar above it would turn an app back
 * into a web page. But the secondary pages a link can reach — checkout, legal, a
 * category — still need a way back to the chat, so they get a wordmark and nothing
 * else.
 *
 * Imported directly by the template's own views rather than through
 * `templates/chrome.tsx`: that dispatcher imports the registry, which imports this,
 * and the cycle would only show up at runtime.
 */
export function MbahgptHeader({ user, brand }: ChromeProps) {
  // The brand carries the storefront's locale, so the header stays synchronous.
  const t = translator(brand.locale);
  return (
    <header className="border-b border-[var(--rule)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" aria-label={brand.name} className="truncate transition-opacity hover:opacity-70">
          <SiteLogo brand={brand} imgClassName="h-6 w-auto max-w-[140px]" markClassName="h-5 w-5" />
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeSwitch />
          {/* Signing in returns to the chat, like every other entry point on this
              storefront — its homepage is the product, not a step towards one.
              A signed-in visitor still gets a direct route to the panel. */}
          <Link
            href={user ? "/panel" : "/login?next=/"}
            className="text-xs text-[var(--muted)] transition-colors hover:text-foreground"
          >
            {user ? t("nav.panel") : t("nav.signIn")}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** One line. A tool has a colophon, not a sitemap. */
export async function MbahgptFooter() {
  const [site, locale] = await Promise.all([currentSite(), requestLocale()]);
  const t = translator(locale);
  return (
    <footer className="mt-10 shrink-0 border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4 py-7 text-xs text-[var(--muted)]">
        <span>
          © {new Date().getFullYear()} {site.name}
        </span>
        <Link href="/" className="transition-colors hover:text-foreground">
          {t("chat.nav")}
        </Link>
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
