"use client";

import { useMemo, useState, useTransition } from "react";
import {
  type CategoryRow,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/actions/categories";
import { CategoryIcon, CATEGORY_ICONS, ICON_KEYS } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

type Props = { initialCategories: CategoryRow[] };

/** Order rows as [parent, ...its children] groups, each sorted by sort_order. */
function orderRows(categories: CategoryRow[]): { cat: CategoryRow; depth: number }[] {
  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const tops = sorted.filter((c) => !c.parent_id);
  const rows: { cat: CategoryRow; depth: number }[] = [];
  for (const top of tops) {
    rows.push({ cat: top, depth: 0 });
    for (const child of sorted.filter((c) => c.parent_id === top.id)) {
      rows.push({ cat: child, depth: 1 });
    }
  }
  // Any orphan (parent_id points at a missing/non-top category) shown flat.
  const placed = new Set(rows.map((r) => r.cat.id));
  for (const c of sorted) if (!placed.has(c.id)) rows.push({ cat: c, depth: 0 });
  return rows;
}

export function CategoriesTable({ initialCategories }: Props) {
  const t = useT();
  const [categories, setCategories] = useState(initialCategories);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => orderRows(categories), [categories]);
  const nameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );
  // Top-level categories are the only valid parents (2-level hierarchy).
  const parentOptions = useMemo(
    () => categories.filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );

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
        <Button
          size="md"
          onClick={startCreate}
          leftIcon={<PlusIcon className="w-4 h-4" />}
          className="text-white hover:opacity-90"
        >
          {t("common.add")}
        </Button>
      </div>

      {creating && (
        <CategoryForm
          parents={parentOptions}
          onSubmit={async (name, slug, sort_order, icon, parent_id) => {
            const res = await createCategory(name, slug, sort_order, icon, parent_id);
            if (!res.ok) {
              setError(res.error ?? "Gagal.");
              return false;
            }
            setCategories((prev) =>
              [
                ...prev,
                { id: res.id ?? crypto.randomUUID(), name, slug, sort_order, icon, parent_id },
              ].sort((a, b) => a.sort_order - b.sort_order),
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
        {rows.map(({ cat, depth }) =>
          editing?.id === cat.id ? (
            <CategoryForm
              key={cat.id}
              initial={editing}
              parents={parentOptions.filter((p) => p.id !== cat.id)}
              onSubmit={async (name, slug, sort_order, icon, parent_id) => {
                const res = await updateCategory(cat.id, name, slug, sort_order, icon, parent_id);
                if (!res.ok) {
                  setError(res.error ?? "Gagal.");
                  return false;
                }
                setCategories((prev) =>
                  prev
                    .map((c) =>
                      c.id === cat.id ? { ...c, name, slug, sort_order, icon, parent_id } : c,
                    )
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
              className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm ${
                depth > 0 ? "ml-4 border-l-2 border-l-[var(--primary)]/30" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon icon={cat.icon} className="w-4 h-4 shrink-0 text-[var(--muted)]" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {depth > 0 && <span className="text-[var(--muted)]">↳ </span>}
                      {cat.name}
                    </p>
                    <p className="text-sm text-[var(--muted)] truncate">
                      /{cat.slug}
                      {cat.parent_id && nameById.get(cat.parent_id)
                        ? ` · induk: ${nameById.get(cat.parent_id)}`
                        : " · kategori utama"}
                    </p>
                  </div>
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
                  {t("common.edit")}
                </button>
                <DeleteButton
                  id={cat.id}
                  deleting={deleting}
                  onDelete={async () => {
                    setDeleting(cat.id);
                    const res = await deleteCategory(cat.id);
                    if (res.ok) {
                      // Children of a deleted parent become top-level (DB on delete set null).
                      setCategories((prev) =>
                        prev
                          .filter((c) => c.id !== cat.id)
                          .map((c) => (c.parent_id === cat.id ? { ...c, parent_id: null } : c)),
                      );
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
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Induk</th>
                <th className="text-center px-4 py-3 font-medium text-[var(--muted)]">Icon</th>
                <th className="text-center px-4 py-3 font-medium text-[var(--muted)]">Urutan</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted)]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cat, depth }) =>
                editing?.id === cat.id ? (
                  <tr key={cat.id}>
                    <td colSpan={6} className="px-4 py-3">
                      <CategoryForm
                        initial={editing}
                        inline
                        parents={parentOptions.filter((p) => p.id !== cat.id)}
                        onSubmit={async (name, slug, sort_order, icon, parent_id) => {
                          const res = await updateCategory(cat.id, name, slug, sort_order, icon, parent_id);
                          if (!res.ok) {
                            setError(res.error ?? "Gagal.");
                            return false;
                          }
                          setCategories((prev) =>
                            prev
                              .map((c) =>
                                c.id === cat.id ? { ...c, name, slug, sort_order, icon, parent_id } : c,
                              )
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
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span className={depth > 0 ? "inline-flex items-center gap-1.5 pl-5" : ""}>
                        {depth > 0 && <span className="text-[var(--muted)]">↳</span>}
                        {cat.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">/{cat.slug}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {cat.parent_id && nameById.get(cat.parent_id) ? (
                        nameById.get(cat.parent_id)
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-subtle)]">utama</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CategoryIcon icon={cat.icon} className="w-4 h-4 inline-block text-[var(--muted)]" />
                    </td>
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
                              setCategories((prev) =>
                                prev
                                  .filter((c) => c.id !== cat.id)
                                  .map((c) => (c.parent_id === cat.id ? { ...c, parent_id: null } : c)),
                              );
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
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                    {t("panel.noCategories")}
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
  parents: CategoryRow[];
  defaultSortOrder?: number;
  inline?: boolean;
  onSubmit: (
    name: string,
    slug: string,
    sort_order: number,
    icon: string,
    parent_id: string | null,
  ) => Promise<boolean>;
  onCancel: () => void;
  error: string | null;
};

function CategoryForm({ initial, parents, defaultSortOrder, inline, onSubmit, onCancel, error }: FormProps) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? defaultSortOrder ?? 0);
  const [icon, setIcon] = useState(initial?.icon ?? "default");
  const [parentId, setParentId] = useState<string>(initial?.parent_id ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
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
      await onSubmit(name, slug, sortOrder, icon, parentId.trim() || null);
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
          placeholder={t("panel.categoryName")}
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
          placeholder={t("panel.categorySlug")}
          className={inputClass}
          required
        />
      </div>
      <div className={inline ? "min-w-[150px]" : ""}>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">Induk</label>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className={inputClass}
        >
          <option value="">{t("panel.categoryRoot")}</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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
      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">Icon</label>
        <div className="relative">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setPickerOpen((o) => !o)}
            leftIcon={<CategoryIcon icon={icon} className="w-4 h-4" />}
            rightIcon={
              <svg className="w-3 h-3 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            }
            className="bg-background gap-2"
          >
            <span className="text-[var(--muted)]">{CATEGORY_ICONS[icon]?.label ?? icon}</span>
          </Button>
          {pickerOpen && (
            <div className="absolute z-30 mt-1 p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg grid grid-cols-4 gap-1 w-max max-w-[240px]">
              {ICON_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  title={CATEGORY_ICONS[key].label}
                  onClick={() => {
                    setIcon(key);
                    setPickerOpen(false);
                  }}
                  className={`p-2 rounded-md transition-colors ${
                    icon === key
                      ? "bg-[var(--accent-subtle)] text-[var(--primary)]"
                      : "text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)]"
                  }`}
                >
                  <CategoryIcon icon={key} className="w-5 h-5" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={inline ? "flex items-center gap-2" : "flex items-center gap-2 pt-1"}>
        <Button
          type="submit"
          size="md"
          loading={isPending}
          disabled={isPending}
          className="text-white hover:opacity-90"
        >
          {isPending ? "Menyimpan…" : initial ? "Simpan" : "Tambah"}
        </Button>
        <Button
          variant="secondary"
          size="md"
          disabled={isPending}
          onClick={onCancel}
          className="text-[var(--muted)] hover:text-foreground"
        >
          {t("common.cancel")}
        </Button>
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
  const t = useT();
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
          {t("common.cancel")}
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
      {t("common.delete")}
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
