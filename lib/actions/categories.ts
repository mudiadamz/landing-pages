"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/db/server";
import { requireAdmin, requireFeature } from "./profiles";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  icon: string;
  /** NULL = top-level (parent) category; set = sub-category of that parent. */
  parent_id: string | null;
};

export async function getAdminCategories(): Promise<CategoryRow[]> {
  const isAdmin = await requireFeature("categories");
  if (!isAdmin) return [];

  const db = await createClient();
  const { data, error } = await db
    .from("lp_landing_page_categories")
    .select("id, name, slug, sort_order, icon, parent_id")
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as CategoryRow[];
}

/**
 * Enforce a clean 2-level hierarchy: a category's parent must exist, be
 * top-level, not be itself, and the category must not already have children.
 * Returns an error message, or null when valid.
 */
async function validateParent(
  db: Awaited<ReturnType<typeof createClient>>,
  selfId: string | null,
  parentId: string | null,
): Promise<string | null> {
  if (!parentId) return null; // top-level — always valid
  if (selfId && parentId === selfId)
    return "Kategori tidak bisa menjadi induk dirinya sendiri.";

  const { data: parent } = await db
    .from("lp_landing_page_categories")
    .select("id, parent_id")
    .eq("id", parentId)
    .single();
  if (!parent) return "Induk tidak ditemukan.";
  if (parent.parent_id)
    return "Induk harus kategori utama (maksimal 2 tingkat).";

  if (selfId) {
    const { count } = await db
      .from("lp_landing_page_categories")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", selfId);
    if ((count ?? 0) > 0)
      return "Kategori ini punya sub-kategori, pindahkan dulu sub-kategorinya.";
  }
  return null;
}

export async function createCategory(
  name: string,
  slug: string,
  sort_order: number,
  icon: string = "default",
  parent_id: string | null = null,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  // Company only, and on purpose — not requireFeature("categories"), which
  // lets every Agent through. Categories are ONE catalog shared by all
  // storefronts: each site's shelf is a slice of it (lp_sites.category_ids), so
  // renaming or deleting one changes every domain at once. The database already
  // said so (Company-only policies); this used to let an Agent in and then
  // fail on the write. See docs/plans/test-before-leaving-supabase.md, fase 5.
  if (!(await requireAdmin())) return { ok: false, error: "Hanya Company yang bisa mengubah kategori." };

  const normalizedSlug = slug.toLowerCase().trim().replace(/\s+/g, "-");
  if (!normalizedSlug) return { ok: false, error: "Slug tidak boleh kosong." };
  if (!name.trim()) return { ok: false, error: "Nama tidak boleh kosong." };

  const db = await createClient();
  const parentError = await validateParent(db, null, parent_id);
  if (parentError) return { ok: false, error: parentError };

  const { data, error } = await db
    .from("lp_landing_page_categories")
    .insert({ name: name.trim(), slug: normalizedSlug, sort_order, icon, parent_id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Slug sudah digunakan." };
    return { ok: false, error: "Gagal menyimpan." };
  }

  revalidateAll();
  return { ok: true, id: data.id };
}

export async function updateCategory(
  id: string,
  name: string,
  slug: string,
  sort_order: number,
  icon: string = "default",
  parent_id: string | null = null,
): Promise<{ ok: boolean; error?: string }> {
  // Company only, and on purpose — not requireFeature("categories"), which
  // lets every Agent through. Categories are ONE catalog shared by all
  // storefronts: each site's shelf is a slice of it (lp_sites.category_ids), so
  // renaming or deleting one changes every domain at once. The database already
  // said so (Company-only policies); this used to let an Agent in and then
  // fail on the write. See docs/plans/test-before-leaving-supabase.md, fase 5.
  if (!(await requireAdmin())) return { ok: false, error: "Hanya Company yang bisa mengubah kategori." };

  const normalizedSlug = slug.toLowerCase().trim().replace(/\s+/g, "-");
  if (!normalizedSlug) return { ok: false, error: "Slug tidak boleh kosong." };
  if (!name.trim()) return { ok: false, error: "Nama tidak boleh kosong." };

  const db = await createClient();
  const parentError = await validateParent(db, id, parent_id);
  if (parentError) return { ok: false, error: parentError };

  const { error } = await db
    .from("lp_landing_page_categories")
    .update({ name: name.trim(), slug: normalizedSlug, sort_order, icon, parent_id })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Slug sudah digunakan." };
    return { ok: false, error: "Gagal menyimpan." };
  }

  revalidateAll();
  return { ok: true };
}

export async function deleteCategory(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  // Company only, and on purpose — not requireFeature("categories"), which
  // lets every Agent through. Categories are ONE catalog shared by all
  // storefronts: each site's shelf is a slice of it (lp_sites.category_ids), so
  // renaming or deleting one changes every domain at once. The database already
  // said so (Company-only policies); this used to let an Agent in and then
  // fail on the write. See docs/plans/test-before-leaving-supabase.md, fase 5.
  if (!(await requireAdmin())) return { ok: false, error: "Hanya Company yang bisa mengubah kategori." };

  const db = await createClient();
  const { error } = await db
    .from("lp_landing_page_categories")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: "Gagal menghapus." };

  revalidateAll();
  return { ok: true };
}

function revalidateAll() {
  // Purge the tagged unstable_cache entries immediately — revalidatePath alone
  // does NOT invalidate getCategories / getCachedHomepagePages, so without this
  // the public nav + /category pages would serve stale structure for up to 60s.
  updateTag("categories");
  updateTag("homepage-pages");
  revalidatePath("/panel/categories");
  revalidatePath("/");
  revalidatePath("/panel");
}
