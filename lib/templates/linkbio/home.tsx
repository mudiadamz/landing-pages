import Link from "next/link";
import { SocialLinks } from "@/components/social-links";
import { BrandAvatar } from "@/components/site-logo";
import { siteBrand } from "@/lib/site-brand";
import { LinkbioFooter } from "./chrome";
import { LinkRow } from "./link-row";
import type { TemplateProps } from "../registry";

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
export function LinkbioHome({ site, pages, categories }: TemplateProps) {
  const parents = categories.filter((c) => !c.parent_id);

  return (
    <div
      data-template="linkbio"
      className="flex min-h-screen flex-col bg-background text-foreground"
    >
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-6 pt-10 sm:pt-14">
        {/* Profile. The site icon IS the profile photo here — this is the surface the
            square upload exists for, and initials are the stand-in, not the design. */}
        <div className="flex flex-col items-center text-center">
          <BrandAvatar brand={siteBrand(site)} />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {site.name}
          </h1>
          {site.tagline && (
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
              {site.tagline}
            </p>
          )}
          <SocialLinks variant="row" className="mt-4 justify-center gap-x-4 text-xs" />
        </div>

        {/* Filter chips — only worth showing when there is more than one */}
        {parents.length > 1 && (
          <nav className="mt-7 flex flex-wrap justify-center gap-2">
            {parents.map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition-colors hover:border-[var(--primary)]/50 hover:text-foreground"
              >
                {c.name}
              </Link>
            ))}
          </nav>
        )}

        {/* The stack */}
        {pages.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center text-sm text-[var(--muted)]">
            Belum ada tautan di sini.
          </p>
        ) : (
          <ul className="mt-7 space-y-2.5">
            {pages.map((page, i) => (
              <LinkRow key={page.id} page={page} priority={i < 3} />
            ))}
          </ul>
        )}
      </main>

      <LinkbioFooter />
    </div>
  );
}
