import Link from "next/link";
import { SocialLinksCompact } from "@/components/social-links-compact";
import { BrandAvatar } from "@/components/site-logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { VerifiedBadge } from "@/components/verified-badge";
import { siteBrand } from "@/lib/site-brand";
import { LinkbioFooter } from "./chrome";
import { SearchProvider, SearchToggle, SearchField } from "./linkbio-search";
import { LinkRow } from "./link-row";
import { Pager } from "./pager";
import { listingHref, toggleCategoryHref } from "./listing-url";
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
export function LinkbioHome({
  site,
  pages,
  categories,
  user,
  founder,
  listing,
  query,
  sort,
  activeCategories,
}: TemplateProps) {
  // Everything the three controls have to preserve about each other.
  const state = { categories: activeCategories, query, sort };
  const parents = categories.filter((c) => !c.parent_id);
  // A founder card that is switched off, or has no name, falls back to the
  // storefront's own identity rather than rendering an empty person.
  const showFounder = founder.enabled && !!founder.name.trim();
  // The cover belongs to the founder card, and shows only when that card does.
  const cover = showFounder ? founder.coverUrl.trim() : "";

  return (
    <SearchProvider query={query}>
    <div
      data-template="linkbio"
      className="relative flex min-h-screen flex-col bg-background text-foreground"
    >
      {/* Cover. Starts at the document's true top and, with viewport-fit=cover,
          is pulled up by the safe-area inset so it fills the status-bar strip in
          a standalone window instead of leaving a band of page colour there.
          A regular browser tab paints its own chrome and no page can reach it —
          the image stops at the top of the viewport there.

          Fades into the page rather than ending on a line, so the profile below
          sits ON the cover instead of under a separate block. aria-hidden: it is
          decoration, and the name it sits behind is the actual heading. */}
      {cover && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-0 overflow-hidden"
          style={{
            top: "calc(-1 * env(safe-area-inset-top, 0px))",
            height: "calc(15rem + env(safe-area-inset-top, 0px))",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[var(--background)]" />
        </div>
      )}
      {/* Three icons, and deliberately only three.
          The page still renders no header — a nav bar would turn the bio card
          back into a website (see below). These sit in the margin above the card
          as bare glyphs with no bar, no border and no wordmark, so they read as
          controls on the page rather than as chrome around it. */}
      <div className="relative z-10 mx-auto flex w-full max-w-xl items-center justify-end gap-0.5 px-3 pt-3">
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

      <main className="relative z-10 mx-auto w-full max-w-xl flex-1 px-5 pb-6 pt-6 sm:pt-8">
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
          <h1 className="mt-4 flex items-center justify-center gap-1.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            <span className="min-w-0 truncate">{showFounder ? founder.name : site.name}</span>
            {showFounder && founder.verified && <VerifiedBadge className="h-5 w-5 sm:h-6 sm:w-6" />}
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

        {/* Filter chips. Each one toggles its category on the page itself rather
            than navigating to a category route — pressing an active chip turns
            it off, and several can be on at once (union, not intersection).
            Links rather than buttons, so the filter is in the URL and survives a
            reload, a share and the back button. */}
        {parents.length > 1 && (
          <nav className="mt-7 flex flex-wrap justify-center gap-2" aria-label="Filter kategori">
            {parents.map((c) => {
              const on = activeCategories.includes(c.slug);
              return (
                <Link
                  key={c.id}
                  href={toggleCategoryHref(state, c.slug)}
                  aria-pressed={on}
                  scroll={false}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    on
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--accent-subtle)] text-[var(--primary)] hover:bg-[var(--primary)]/15"
                  }`}
                >
                  {c.name}
                </Link>
              );
            })}
            {activeCategories.length > 0 && (
              <Link
                href={listingHref({ categories: [], query, sort })}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--muted)] underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Semua
              </Link>
            )}
          </nav>
        )}

        {/* The field submits to the server; `pages` is already the matching
            page of results. */}
        <SearchField total={listing.total} categories={activeCategories} sort={sort} />

        {pages.length === 0 ? (
          <p className="mt-7 rounded-2xl bg-[var(--accent-subtle)] px-6 py-12 text-center text-sm text-[var(--muted)]">
            {query ? "Coba kata lain." : "Belum ada tautan di sini."}
          </p>
        ) : (
          <ul className="mt-7 space-y-2.5">
            {pages.map((page, i) => (
              /* priority only on the first page: on page two the top rows are
                 different products and the hint would preload the wrong images. */
              <LinkRow key={page.id} page={page} priority={listing.page === 1 && i < 3} />
            ))}
          </ul>
        )}

        <Pager
          page={listing.page}
          pageCount={listing.pageCount}
          query={query}
          sort={sort}
          categories={activeCategories}
        />
      </main>

      <LinkbioFooter />
    </div>
    </SearchProvider>
  );
}
