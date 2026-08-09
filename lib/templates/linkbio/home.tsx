import Link from "next/link";
import { SocialLinksCompact } from "@/components/social-links-compact";
import { BrandAvatar } from "@/components/site-logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { siteBrand } from "@/lib/site-brand";
import { LinkbioFooter } from "./chrome";
import { SearchProvider, SearchToggle, SearchResults } from "./linkbio-search";
import type { TemplateProps } from "../registry";

/** Signed-in goes to the panel; everyone else to the login screen. */
function AccountIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8" r="3.5" strokeLinecap="round" />
      <path strokeLinecap="round" d="M4.5 20a7.5 7.5 0 0115 0" />
    </svg>
  );
}

/**
 * A link-in-bio page: profile block, then a vertical stack of tappable rows.
 *
 * NO HEADER, on purpose. This is the one page where chrome would break the whole
 * idea — a bio card with a nav bar above it is just a website again. Secondary
 * pages still get LinkbioHeader so a visitor who taps through can get back.
 *
 * Also no hero config, no testimonials, no FAQ. The format's entire premise is
 * that there is nothing to read and nothing to scroll past: the links ARE the
 * page. Everything added here costs a tap somewhere else.
 *
 * Categories become filter chips rather than a nav rail, because on this shape
 * they are a way to shorten the list, not a place to go.
 */
export function LinkbioHome({ site, pages, categories, user, founder }: TemplateProps) {
  const parents = categories.filter((c) => !c.parent_id);
  // A founder card that is switched off, or has no name, falls back to the
  // storefront's own identity rather than rendering an empty person.
  const showFounder = founder.enabled && !!founder.name.trim();

  return (
    <SearchProvider>
    <div
      data-template="linkbio"
      className="flex min-h-screen flex-col bg-background text-foreground"
    >
      {/* Three icons, and deliberately only three.
          The page still renders no header — a nav bar would turn the bio card
          back into a website (see below). These sit in the margin above the card
          as bare glyphs with no bar, no border and no wordmark, so they read as
          controls on the page rather than as chrome around it. */}
      <div className="mx-auto flex w-full max-w-xl items-center justify-end gap-0.5 px-3 pt-3">
        <SearchToggle />
        <Link
          href={user ? "/panel" : "/login"}
          aria-label={user ? "Buka panel" : "Masuk"}
          title={user ? "Buka panel" : "Masuk"}
          className="rounded-lg p-2 text-[var(--muted)] transition-all duration-150 hover:bg-[var(--accent-subtle)] hover:text-foreground active:scale-[0.95]"
        >
          <AccountIcon className="h-5 w-5" />
        </Link>
        <ThemeSwitch />
      </div>

      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-6 pt-6 sm:pt-8">
        {/* Profile: the FOUNDER, not the storefront.
            A link-in-bio page is somebody's page — the photo, the name and the
            one line under it are the same card the checkout page already shows,
            so the person is identical on both and cannot drift. The site's own
            icon and name are the fallback for a storefront whose founder card is
            switched off. */}
        <div className="flex flex-col items-center text-center">
          {showFounder && founder.photoUrl ? (
            /* Plain <img>: the photo can be a local path or an uploaded URL,
               and next/image would need every storage host configured. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={founder.photoUrl}
              alt={founder.name}
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            <BrandAvatar brand={siteBrand(site)} />
          )}
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {showFounder ? founder.name : site.name}
          </h1>
          {(showFounder ? founder.role : site.tagline) && (
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
              {showFounder ? founder.role : site.tagline}
            </p>
          )}
          {/* Icons only, and capped: labels wrapped this row onto a second line
              to spell out four words the glyphs already say. */}
          <SocialLinksCompact className="mt-4" />
        </div>

        {/* Filter chips — only worth showing when there is more than one */}
        {parents.length > 1 && (
          <nav className="mt-7 flex flex-wrap justify-center gap-2">
            {parents.map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className="rounded-full bg-[var(--accent-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15"
              >
                {c.name}
              </Link>
            ))}
          </nav>
        )}

        {/* The search field (when open) and the stack it filters. */}
        <SearchResults pages={pages} />
      </main>

      <LinkbioFooter />
    </div>
    </SearchProvider>
  );
}
