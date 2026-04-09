"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "./profiles";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  icon: string;
};

export async function getAdminCategories(): Promise<CategoryRow[]> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landing_page_categories")
    .select("id, name, slug, sort_order, icon")
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as CategoryRow[];
}

export async function createCategory(
  name: string,
  slug: string,
  sort_order: number,
  icon: string = "default",
): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const normalizedSlug = slug.toLowerCase().trim().replace(/\s+/g, "-");
  if (!normalizedSlug) return { ok: false, error: "Slug tidak boleh kosong." };
  if (!name.trim()) return { ok: false, error: "Nama tidak boleh kosong." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("landing_page_categories")
    .insert({ name: name.trim(), slug: normalizedSlug, sort_order, icon });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Slug sudah digunakan." };
    return { ok: false, error: "Gagal menyimpan." };
  }

  revalidateAll();
  return { ok: true };
}

export async function updateCategory(
  id: string,
  name: string,
  slug: string,
  sort_order: number,
  icon: string = "default",
): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const normalizedSlug = slug.toLowerCase().trim().replace(/\s+/g, "-");
  if (!normalizedSlug) return { ok: false, error: "Slug tidak boleh kosong." };
  if (!name.trim()) return { ok: false, error: "Nama tidak boleh kosong." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("landing_page_categories")
    .update({ name: name.trim(), slug: normalizedSlug, sort_order, icon })
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
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("landing_page_categories")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: "Gagal menghapus." };

  revalidateAll();
  return { ok: true };
}

function revalidateAll() {
  revalidatePath("/panel/categories");
  revalidatePath("/");
  revalidatePath("/panel");
}
