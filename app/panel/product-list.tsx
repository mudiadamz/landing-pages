"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LandingPageCategory } from "@/lib/actions/landing-pages";
import { PinButton } from "./pin-button";
import { DeleteButton } from "./delete-button";
import { VisibilityToggle } from "./visibility-toggle";

// 50, not 8. The list is a working surface — you come here to find a product
// and open it — and paging every 8 rows meant a 16-product catalog was already
// split in two. The pagination control stays for when a catalog outgrows this.
const PAGE_SIZE = 50;

const ACTION_LINK_SM =
  "inline-flex items-center justify-center p-2 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--background)] transition active:scale-90";
const ACTION_LINK_LG =
  "inline-flex items-center justify-center h-11 flex-1 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--background)] transition active:scale-95";

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  featured?: boolean | null;
  published?: boolean | null;
  category_id?: string | null;
  view_count?: number | null;
};

type SortKey = "updated" | "views" | "title";
type SortDir = "asc" | "desc";

function formatDate(s: string) {
  return new Date(s).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function ChartIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6m4 6V5m4 14v-9M5 19h14" />
    </svg>
  );
}

function EditIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

// Open-in-new-tab icon for "Lihat preview" — distinct from the eye/eye-off
// used by the frontend show/hide toggle so the two actions don't look alike.
function ExternalIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function SortTh({
  label,
  sortField,
  sortKey,
  sortDir,
  onSort,
  right,
}: {
  label: string;
  sortField: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = sortKey === sortField;
  return (
    <th className={`px-4 py-3.5 text-sm font-medium text-foreground ${right ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortField)}
        className="inline-flex items-center gap-1 transition-colors hover:text-[var(--primary)]"
      >
        {label}
        <span className={`text-[10px] ${active ? "text-[var(--primary)]" : "text-[var(--muted)]/40"}`}>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function HiddenBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--background)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
      Disembunyikan
    </span>
  );
}

function RowActions({ p, size = "sm" }: { p: ProductRow; size?: "sm" | "lg" }) {
  const linkClass = size === "lg" ? ACTION_LINK_LG : ACTION_LINK_SM;
  const iconClass = size === "lg" ? "w-5 h-5" : "w-4 h-4";
  return (
    <>
      <VisibilityToggle id={p.id} published={p.published !== false} size={size} />
      <PinButton id={p.id} featured={!!p.featured} size={size} />
      <Link href={`/panel/product/${p.id}/stats`} className={linkClass} title="Statistik" aria-label="Statistik">
        <ChartIcon className={iconClass} />
      </Link>
      <Link href={`/panel/product/${p.id}/edit`} className={linkClass} title="Edit" aria-label="Edit">
        <EditIcon className={iconClass} />
      </Link>
      <Link href={`/preview/${p.slug}`} target="_blank" rel="noopener noreferrer" className={linkClass} title="Lihat preview" aria-label="Lihat preview">
        <ExternalIcon className={iconClass} />
      </Link>
      <DeleteButton id={p.id} size={size} />
    </>
  );
}

export function ProductList({
  pages,
  categories,
}: {
  pages: ProductRow[];
  categories: LandingPageCategory[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Selecting a parent category also matches products in its sub-categories.
    const catIds = category
      ? new Set<string>([
          category,
          ...categories.filter((c) => c.parent_id === category).map((c) => c.id),
        ])
      : null;
    return pages.filter((p) => {
      if (q && !(p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))) return false;
      if (catIds && !(p.category_id && catIds.has(p.category_id))) return false;
      return true;
    });
  }, [pages, query, category, categories]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "views") cmp = (a.view_count ?? 0) - (b.view_count ?? 0);
      else if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return cmp * dir;
    });
  }, [filtered, sortKey, sortDir]);

  // Clicking a column header sorts by it; clicking the active one flips direction.
  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" ? "asc" : "desc");
    }
    setPage(1);
  }

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = sorted.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Search + category filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
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

        {categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            aria-label="Filter kategori"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 sm:w-56"
          >
            <option value="">Semua kategori</option>
            {categories
              .filter((c) => !c.parent_id)
              .map((parent) => {
                const children = categories.filter((c) => c.parent_id === parent.id);
                if (children.length === 0) {
                  return (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  );
                }
                return (
                  <optgroup key={parent.id} label={parent.name}>
                    <option value={parent.id}>{parent.name} — semua</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
          </select>
        )}

        {/* Sort control — mobile only (desktop sorts via table headers). */}
        <select
          value={`${sortKey}:${sortDir}`}
          onChange={(e) => {
            const [k, d] = e.target.value.split(":") as [SortKey, SortDir];
            setSortKey(k);
            setSortDir(d);
            setPage(1);
          }}
          aria-label="Urutkan"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 sm:hidden"
        >
          <option value="updated:desc">Terbaru diperbarui</option>
          <option value="updated:asc">Terlama diperbarui</option>
          <option value="views:desc">Kunjungan terbanyak</option>
          <option value="views:asc">Kunjungan tersedikit</option>
          <option value="title:asc">Judul A–Z</option>
          <option value="title:desc">Judul Z–A</option>
        </select>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted)] shadow-sm">
          {query.trim()
            ? `Tidak ada produk yang cocok dengan “${query.trim()}”.`
            : "Tidak ada produk pada kategori ini."}
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
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {formatDate(p.updated_at)} · {formatNumber(p.view_count ?? 0)} kunjungan
                </p>
                <div className="mt-3 flex items-stretch gap-2">
                  <RowActions p={p} size="lg" />
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
                    <SortTh label="Judul" sortField="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Slug</th>
                    <SortTh label="Kunjungan" sortField="views" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} right />
                    <SortTh label="Diperbarui" sortField="updated" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
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
                      <td className="px-4 py-3.5 text-right text-sm tabular-nums text-[var(--muted)]">
                        {formatNumber(p.view_count ?? 0)}
                      </td>
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
