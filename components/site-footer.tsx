import Link from "next/link";
import { SocialLinks } from "@/components/social-links";
import { getSocialUrls, getHiringContent } from "@/lib/actions/site-settings";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { getSiteContent } from "@/lib/actions/site-settings";
import { currentSite } from "@/lib/site-resolve";
import { LanguageSwitcher } from "@/components/language-switcher";
import { requestLocale } from "@/lib/i18n/request";
import { t } from "@/lib/i18n";

/**
 * Bottom of the public shell: the footer itself plus the mobile bottom nav.
 * The nav lives here so every page that renders the public shell gets it for
 * free — /lp (fullscreen preview) and /panel (own sidebar) render no footer and
 * so stay untouched.
 *
 * Unlike the header, this resolves the site itself: it is a server component, so
 * there is no client boundary forcing the brand through props.
 */
export async function SiteFooter() {
  const [content, supabase, site, socialUrls, locale, hiring] = await Promise.all([
    getSiteContent(),
    createClient(),
    currentSite(),
    getSocialUrls(),
    requestLocale(),
    getHiringContent(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
    <footer className="relative border-t border-[var(--border)] py-12 sm:py-16 shrink-0 overflow-hidden">
      <div
        className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--accent-cool) 0%, transparent 70%)" }}
        aria-hidden
      />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)] max-w-md">
              {content.footerTagline}
            </p>
            <div>
              <p className="text-xs font-medium text-foreground mb-2">{t("panel.tabSocial", {}, locale)}</p>
              <SocialLinks
                variant="row"
                className="gap-x-4 gap-y-2 text-xs"
                urls={socialUrls}
                label={t("home.socialLinks", {}, locale)}
              />
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/" className="inline-block py-1 text-[var(--muted)] hover:text-foreground active:scale-[0.98] active:opacity-80 transition-all duration-150">
              {t("nav.home", {}, locale)}
            </Link>
            <Link href="/about" className="inline-block py-1 text-[var(--muted)] hover:text-foreground active:scale-[0.98] active:opacity-80 transition-all duration-150">
              {t("nav.about", {}, locale)}
            </Link>
            <Link href="/contact" className="inline-block py-1 text-[var(--muted)] hover:text-foreground active:scale-[0.98] active:opacity-80 transition-all duration-150">
              {t("nav.contact", {}, locale)}
            </Link>
            <Link href="/privacy" className="inline-block py-1 text-[var(--muted)] hover:text-foreground active:scale-[0.98] active:opacity-80 transition-all duration-150">
              {t("nav.privacyPolicy", {}, locale)}
            </Link>
            <Link href="/terms" className="inline-block py-1 text-[var(--muted)] hover:text-foreground active:scale-[0.98] active:opacity-80 transition-all duration-150">
              {t("nav.termsOfService", {}, locale)}
            </Link>
            <Link href="/refund" className="inline-block py-1 text-[var(--muted)] hover:text-foreground active:scale-[0.98] active:opacity-80 transition-all duration-150">
              {t("nav.refund", {}, locale)}
            </Link>
            {/* Only while the vacancy is open — a dead link to a 404 is worse
                than no link. */}
            {hiring.enabled && (
              <Link href="/hiring" className="inline-block py-1 text-[var(--muted)] hover:text-foreground active:scale-[0.98] active:opacity-80 transition-all duration-150">
                {t("nav.hiring", {}, locale)}
              </Link>
            )}
          </nav>
        </div>
        <div className="mt-8 flex flex-col items-center gap-3 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)] sm:flex-row sm:justify-between">
          <span>
            © {new Date().getFullYear()} {site.name || "ADM.UIUX"}
          </span>
          <LanguageSwitcher current={locale} label={t("nav.language", undefined, locale)} />
        </div>
      </div>
    </footer>
    <MobileBottomNav isLoggedIn={!!user} />
    </>
  );
}
