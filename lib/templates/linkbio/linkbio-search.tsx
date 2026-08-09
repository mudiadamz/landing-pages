"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LinkRow } from "./link-row";
import type { LandingPagePublic } from "@/lib/actions/landing-pages";

/**
 * Search for the link-in-bio homepage: an icon in the top row, a field below the
 * profile, and the stack filtered as you type.
 *
 * Filtering happens in the browser over the rows already on the page rather than
 * through a route: the homepage holds the whole (capped) catalogue, so there is
 * nothing to fetch and results land as fast as someone types. A results page
 * would also be a second surface to leave, and the premise of this template is
 * that the links ARE the page.
 *
 * Split into a provider, a toggle and a results list because the icon and the
 * stack live at opposite ends of the layout. The provider takes server-rendered
 * children and passes them through untouched, so the homepage stays a server
 * component — only these three pieces ship as JS.
 */

type SearchCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  q: string;
  setQ: (v: string) => void;
};

const Ctx = createContext<SearchCtx | null>(null);

function useSearch(): SearchCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Linkbio search components must sit inside SearchProvider");
  return ctx;
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  // Closing clears, so reopening never starts inside a stale filter the visitor
  // has forgotten they applied.
  const setOpenAndClear = (v: boolean) => {
    setOpen(v);
    if (!v) setQ("");
  };

  const value = useMemo(() => ({ open, setOpen: setOpenAndClear, q, setQ }), [open, q]);
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

/** The field (when open) and the filtered stack. */
export function SearchResults({ pages }: { pages: LandingPagePublic[] }) {
  const { open, setOpen, q, setQ } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  // Opening puts the caret in the field — otherwise the icon opens a box and
  // then asks for a second tap to use it.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Title and category both match. Category is what people type when they can't
  // remember a title ("novel"), and it is already printed on every row.
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return pages;
    return pages.filter((p) =>
      `${p.title} ${p.category?.name ?? ""}`.toLowerCase().includes(needle),
    );
  }, [pages, q]);

  const searching = !!q.trim();

  return (
    <>
      {open && (
        <div className="mt-5">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 focus-within:border-[var(--primary)]/50">
            <SearchIcon className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                // Esc clears first and closes second — one step back at a time,
                // rather than throwing the panel away over a typo.
                if (e.key !== "Escape") return;
                if (q) setQ("");
                else setOpen(false);
              }}
              placeholder="Cari produk…"
              aria-label="Cari produk"
              // 16px on phones: under that, Safari zooms the page on focus and
              // never zooms back out.
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--muted)] sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup pencarian"
              className="-mr-1 shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {searching && (
            <p aria-live="polite" className="mt-2 px-1 text-xs text-[var(--muted)]">
              {results.length === 0
                ? "Tidak ada yang cocok."
                : `${results.length} hasil`}
            </p>
          )}
        </div>
      )}

      {results.length === 0 ? (
        <p className="mt-7 rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center text-sm text-[var(--muted)]">
          {searching ? "Coba kata lain." : "Belum ada tautan di sini."}
        </p>
      ) : (
        <ul className="mt-7 space-y-2.5">
          {results.map((page, i) => (
            // priority only while unfiltered: after a search the top rows are
            // different products, and the hint would point at images that are no
            // longer first.
            <LinkRow key={page.id} page={page} priority={!searching && i < 3} />
          ))}
        </ul>
      )}
    </>
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
