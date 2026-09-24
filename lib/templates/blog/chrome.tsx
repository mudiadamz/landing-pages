import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { currentSite } from "@/lib/site-resolve";
import { requestLocale } from "@/lib/i18n/request";
import { getBlogPages } from "@/lib/actions/blog";
import { t } from "@/lib/i18n";
import type { ChromeProps } from "../registry";
import { BlogSearchBox } from "./search-box";

/**
 * A masthead for a publication, not a shop.
 *
 * No category rail: a blog's sections are its labels, and those live in the
 * sidebar where they can carry counts. No cart, no account chip — a reader of
 * an archive has nothing to sign in for yet. What it does carry is the search
 * box, because `/search?q=` is a Blogger address people still have bookmarked.
 */
export function BlogHeader({ brand }: ChromeProps) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
        <Link
          href="/"
          aria-label={brand.name}
          className="min-w-0 shrink-0 font-[family-name:var(--font-auman)] text-lg tracking-tight text-foreground transition-opacity hover:opacity-80"
        >
          <SiteLogo brand={brand} imgClassName="h-7 w-auto max-w-[200px]" markClassName="h-6 w-6" />
        </Link>
        <div className="ml-auto w-full sm:w-64">
          <BlogSearchBox />
        </div>
      </div>
    </header>
  );
}

/**
 * The colophon, plus the blog's own pages.
 *
 * Those pages are the imported `/p/*.html` ones — About, privacy policies for
 * apps this blog shipped — and they are the only navigation a Blogger theme put
 * in its footer. Fetched here rather than threaded through every route's props:
 * the footer is rendered by routes that never load blog data at all (a post, an
 * archive), and a prop only the homepage could fill would leave those blank.
 */
export async function BlogFooter() {
  const [site, locale] = await Promise.all([currentSite(), requestLocale()]);
  const pages = await getBlogPages(site.id);

  const legal: [string, string][] = [
    ["/privacy", t("nav.privacy", undefined, locale)],
    ["/terms", t("nav.terms", undefined, locale)],
  ];

  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-8 text-sm sm:px-6">
        {pages.length > 0 && (
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {pages.map((p) => (
              <Link key={p.path} href={p.path} className="text-[var(--muted)] hover:text-[var(--primary)]">
                {p.title}
              </Link>
            ))}
          </nav>
        )}
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
          {legal.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-foreground">
              {label}
            </Link>
          ))}
          <Link href="/feeds/posts/default" className="hover:text-foreground">
            RSS
          </Link>
          <LanguageSwitcher current={locale} label={t("nav.language", undefined, locale)} />
        </nav>
        <p className="text-xs text-[var(--muted)]">
          © {new Date().getFullYear()} {site.name}
        </p>
      </div>
    </footer>
  );
}
