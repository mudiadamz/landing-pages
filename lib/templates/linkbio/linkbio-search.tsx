"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Search for the link-in-bio homepage: an icon in the top row and a field below
 * the profile that submits to the server.
 *
 * It used to filter in the browser over the rows already rendered, which was
 * fine while the whole catalogue fitted in one page and quietly wrong the moment
 * it did not — a match on page three was unfindable. The field is a GET form
 * now: the query goes to the server, the server matches, and the URL holds the
 * state, so a search can be linked, shared and reloaded.
 *
 * Split into a provider and two pieces because the icon and the field sit at
 * opposite ends of the layout. The provider takes server-rendered children and
 * passes them through, so the homepage stays a server component.
 */

type SearchCtx = { open: boolean; setOpen: (v: boolean) => void; query: string };

const Ctx = createContext<SearchCtx | null>(null);

function useSearch(): SearchCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Linkbio search components must sit inside SearchProvider");
  return ctx;
}

export function SearchProvider({
  query,
  children,
}: {
  query: string;
  children: React.ReactNode;
}) {
  // Open when a search is active: arriving on /?q=novel with the field collapsed
  // would show filtered results and no visible reason why.
  const [open, setOpen] = useState(!!query);
  const value = useMemo(() => ({ open, setOpen, query }), [open, query]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The icon, for the top row beside the account and theme controls. */
export function SearchToggle() {
  const { open, setOpen } = useSearch();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-label={open ? "Tutup pencarian" : "Cari produk"}
      title={open ? "Tutup pencarian" : "Cari produk"}
      className={`rounded-lg p-2 transition-all duration-150 hover:bg-[var(--accent-subtle)] active:scale-[0.95] ${
        open ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-foreground"
      }`}
    >
      <SearchIcon className="h-5 w-5" />
    </button>
  );
}

/** The field. A GET form, so the browser owns the navigation. */
export function SearchField({ total }: { total: number }) {
  const { open, setOpen, query } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus on open, but never steal the caret on a page that loaded WITH a query
  // — at that point the visitor is reading results, not typing.
  const openedByUser = useRef(false);

  useEffect(() => {
    if (open && openedByUser.current) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <form method="GET" action="/" className="mt-5">
      <div className="flex items-center gap-2 rounded-xl bg-[var(--card)] px-3 py-2.5 transition-colors focus-within:bg-[var(--accent-subtle)]">
        <SearchIcon className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Cari produk…"
          aria-label="Cari produk"
          // 16px on phones: under that, Safari zooms the page on focus and never
          // zooms back out.
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--muted)] sm:text-sm"
        />
        {query ? (
          /* A link, not a reset button: clearing a search means going back to the
             unfiltered page, which is a navigation. */
          <Link
            href="/"
            aria-label="Hapus pencarian"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:text-foreground"
          >
            <CloseIcon className="h-4 w-4" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              openedByUser.current = false;
              setOpen(false);
            }}
            aria-label="Tutup pencarian"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:text-foreground"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      {query && (
        <p className="mt-2 px-1 text-xs text-[var(--muted)]">
          {total === 0 ? "Tidak ada yang cocok." : `${total} hasil untuk "${query}"`}
        </p>
      )}
    </form>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
