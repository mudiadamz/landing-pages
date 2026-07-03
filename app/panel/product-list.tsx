"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PinButton } from "./pin-button";
import { DeleteButton } from "./delete-button";
import { VisibilityToggle } from "./visibility-toggle";

const PAGE_SIZE = 8;

const ACTION_LINK =
  "inline-flex items-center justify-center p-2 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--background)] transition-colors";

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  featured?: boolean | null;
  published?: boolean | null;
};

function formatDate(s: string) {
  return new Date(s).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function HiddenBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--background)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
      Disembunyikan
    </span>
  );
}

function RowActions({ p }: { p: ProductRow }) {
  return (
    <>
      <VisibilityToggle id={p.id} published={p.published !== false} />
      <PinButton id={p.id} featured={!!p.featured} />
      <Link href={`/panel/landing-pages/${p.id}/edit`} className={ACTION_LINK} title="Edit" aria-label="Edit">
        <EditIcon />
      </Link>
      <Link href={`/lp/${p.slug}`} target="_blank" rel="noopener noreferrer" className={ACTION_LINK} title="Lihat" aria-label="Lihat">
        <ViewIcon />
      </Link>
      <DeleteButton id={p.id} />
    </>
  );
}

export function ProductList({ pages }: { pages: ProductRow[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [pages, query]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--muted)]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Cari judul atau slug…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
        />
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted)] shadow-sm">
          Tidak ada produk yang cocok dengan “{query.trim()}”.
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 sm:hidden">
            {slice.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm ${
                  p.published === false ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-medium text-foreground">{p.title}</p>
                  {p.published === false && <HiddenBadge />}
                </div>
                <p className="truncate font-mono text-xs text-[var(--muted)]">{p.slug}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(p.updated_at)}</p>
                <div className="mt-3 flex items-center gap-1">
                  <RowActions p={p} />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm sm:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Judul</th>
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Slug</th>
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Diperbarui</th>
                    <th className="px-4 py-3.5 text-right text-sm font-medium text-foreground">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--background)]/30 ${
                        p.published === false ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        <span className="flex items-center gap-2">
                          <span className="truncate">{p.title}</span>
                          {p.published === false && <HiddenBadge />}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-sm text-[var(--muted)]">{p.slug}</td>
                      <td className="px-4 py-3.5 text-sm text-[var(--muted)]">{formatDate(p.updated_at)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center justify-end gap-1">
                          <RowActions p={p} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {(pageCount > 1 || total > 0) && (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-xs text-[var(--muted)]">
                Menampilkan {start + 1}–{start + slice.length} dari {total} produk
              </p>
              {pageCount > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((n) => Math.max(1, n - 1))}
                    disabled={currentPage <= 1}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-[var(--background)] disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-sm text-[var(--muted)]">
                    {currentPage} / {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((n) => Math.min(pageCount, n + 1))}
                    disabled={currentPage >= pageCount}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-[var(--background)] disabled:opacity-40"
                  >
                    Berikutnya
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
