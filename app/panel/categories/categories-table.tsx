"use client";

import { useState, useTransition } from "react";
import {
  type CategoryRow,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/actions/categories";

type Props = { initialCategories: CategoryRow[] };

export function CategoriesTable({ initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEdit(cat: CategoryRow) {
    setCreating(false);
    setEditing({ ...cat });
    setError(null);
  }

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setError(null);
  }

  function cancel() {
    setEditing(null);
    setCreating(false);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--muted)]">
          {categories.length} kategori
        </span>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-4 h-4" />
          Tambah
        </button>
      </div>

      {creating && (
        <CategoryForm
          onSubmit={async (name, slug, sort_order) => {
            const res = await createCategory(name, slug, sort_order);
            if (!res.ok) {
              setError(res.error ?? "Gagal.");
              return false;
            }
            setCategories((prev) =>
              [...prev, { id: crypto.randomUUID(), name, slug, sort_order }].sort(
                (a, b) => a.sort_order - b.sort_order,
              ),
            );
            setCreating(false);
            setError(null);
            return true;
          }}
          onCancel={cancel}
          error={error}
          defaultSortOrder={nextSortOrder(categories)}
        />
      )}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {categories.map((cat) =>
          editing?.id === cat.id ? (
            <CategoryForm
              key={cat.id}
              initial={editing}
              onSubmit={async (name, slug, sort_order) => {
                const res = await updateCategory(cat.id, name, slug, sort_order);
                if (!res.ok) {
                  setError(res.error ?? "Gagal.");
                  return false;
                }
                setCategories((prev) =>
                  prev
                    .map((c) => (c.id === cat.id ? { ...c, name, slug, sort_order } : c))
                    .sort((a, b) => a.sort_order - b.sort_order),
                );
                setEditing(null);
                setError(null);
                return true;
              }}
              onCancel={cancel}
              error={error}
            />
          ) : (
            <div
              key={cat.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{cat.name}</p>
                  <p className="text-sm text-[var(--muted)] truncate">/{cat.slug}</p>
                </div>
                <span className="text-xs text-[var(--muted)] tabular-nums shrink-0">
                  #{cat.sort_order}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => startEdit(cat)}
                  className="text-sm font-medium text-[var(--primary)] hover:underline"
                >
                  Edit
                </button>
                <DeleteButton
                  id={cat.id}
                  deleting={deleting}
                  onDelete={async () => {
                    setDeleting(cat.id);
                    const res = await deleteCategory(cat.id);
                    if (res.ok) {
                      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
                    } else {
                      setError(res.error ?? "Gagal menghapus.");
                    }
                    setDeleting(null);
                  }}
                />
              </div>
            </div>
          ),
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Nama</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Slug</th>
                <th className="text-center px-4 py-3 font-medium text-[var(--muted)]">Urutan</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted)]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) =>
                editing?.id === cat.id ? (
                  <tr key={cat.id}>
                    <td colSpan={4} className="px-4 py-3">
                      <CategoryForm
                        initial={editing}
                        inline
                        onSubmit={async (name, slug, sort_order) => {
                          const res = await updateCategory(cat.id, name, slug, sort_order);
                          if (!res.ok) {
                            setError(res.error ?? "Gagal.");
                            return false;
                          }
                          setCategories((prev) =>
                            prev
                              .map((c) => (c.id === cat.id ? { ...c, name, slug, sort_order } : c))
                              .sort((a, b) => a.sort_order - b.sort_order),
                          );
                          setEditing(null);
                          setError(null);
                          return true;
                        }}
                        onCancel={cancel}
                        error={error}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={cat.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{cat.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">/{cat.slug}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{cat.sort_order}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(cat)}
                          className="text-xs font-medium text-[var(--primary)] hover:underline"
                        >
                          Edit
                        </button>
                        <DeleteButton
                          id={cat.id}
                          deleting={deleting}
                          onDelete={async () => {
                            setDeleting(cat.id);
                            const res = await deleteCategory(cat.id);
                            if (res.ok) {
                              setCategories((prev) => prev.filter((c) => c.id !== cat.id));
                            } else {
                              setError(res.error ?? "Gagal menghapus.");
                            }
                            setDeleting(null);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ),
              )}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                    Belum ada kategori.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && !editing && !creating && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

/* ─── Form ─── */

type FormProps = {
  initial?: CategoryRow;
  defaultSortOrder?: number;
  inline?: boolean;
  onSubmit: (name: string, slug: string, sort_order: number) => Promise<boolean>;
  onCancel: () => void;
  error: string | null;
};

function CategoryForm({ initial, defaultSortOrder, inline, onSubmit, onCancel, error }: FormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? defaultSortOrder ?? 0);
  const [isPending, startTransition] = useTransition();
  const [autoSlug, setAutoSlug] = useState(!initial);

  function handleNameChange(v: string) {
    setName(v);
    if (autoSlug) {
      setSlug(
        v
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-"),
      );
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await onSubmit(name, slug, sortOrder);
    });
  }

  const inputClass =
    "w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-background text-foreground text-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30";

  const content = (
    <form onSubmit={handleSubmit} className={inline ? "flex flex-wrap items-end gap-3" : "space-y-3"}>
      <div className={inline ? "flex-1 min-w-[160px]" : ""}>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">Nama</label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Nama kategori"
          className={inputClass}
          required
          autoFocus
        />
      </div>
      <div className={inline ? "flex-1 min-w-[140px]" : ""}>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => {
            setAutoSlug(false);
            setSlug(e.target.value);
          }}
          placeholder="slug-kategori"
          className={inputClass}
          required
        />
      </div>
      <div className={inline ? "w-24" : ""}>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">Urutan</label>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          className={inputClass}
        />
      </div>
      <div className={inline ? "flex items-center gap-2" : "flex items-center gap-2 pt-1"}>
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "Menyimpan…" : initial ? "Simpan" : "Tambah"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors disabled:opacity-50"
        >
          Batal
        </button>
      </div>
      {error && <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );

  if (inline) return content;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      {content}
    </div>
  );
}

/* ─── Delete button with confirmation ─── */

function DeleteButton({
  id,
  deleting,
  onDelete,
}: {
  id: string;
  deleting: string | null;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting === id}
          className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
        >
          {deleting === id ? "Menghapus…" : "Ya, hapus"}
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="text-xs text-[var(--muted)] hover:underline"
        >
          Batal
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
    >
      Hapus
    </button>
  );
}

/* ─── Icons ─── */

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

/* ─── Helpers ─── */

function nextSortOrder(cats: CategoryRow[]): number {
  if (cats.length === 0) return 10;
  return Math.max(...cats.map((c) => c.sort_order)) + 10;
}
