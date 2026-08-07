"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "./profiles";
import { normalizeHost, listSites, type Site } from "@/lib/site-resolve";

// Site is deliberately NOT re-exported here. Every export of a "use server"
// module is compiled into a callable server action, and a type re-export becomes
// an action pointing at a symbol that doesn't exist at runtime. Consumers import
// the type from lib/site-resolve.

export type SiteInput = {
  host: string;
  name: string;
  tagline: string;
  categoryIds: string[];
  active: boolean;
};

/**
 * A hostname, not a URL. Sellers paste "https://resepku.com/" out of habit, and a
 * stored value with a scheme or a trailing slash would never match the Host
 * header — the domain would just silently serve the canonical site forever, which
 * is a miserable thing to debug.
 *
 * Not exported: a "use server" module may only export async functions, since every
 * export becomes a callable server action.
 */
function cleanHost(raw: string): string {
  return normalizeHost(
    (raw ?? "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, ""),
  );
}

/** Rejects what the Host header can never contain. */
function hostError(host: string): string | null {
  if (!host) return "Domain tidak boleh kosong.";
  if (host.length > 253) return "Domain terlalu panjang.";
  if (!/^[a-z0-9.-]+$/.test(host)) return "Domain hanya boleh huruf, angka, titik, dan tanda hubung.";
  if (!host.includes(".")) return "Domain harus punya titik, contoh: resepku.com.";
  if (host.startsWith("-") || host.endsWith("-") || host.startsWith(".") || host.endsWith("."))
    return "Domain tidak boleh diawali/diakhiri titik atau tanda hubung.";
  return null;
}

export async function getSites(): Promise<Site[]> {
  if (!(await requireAdmin())) return [];
  return listSites();
}

/** Everything that invalidates when a site's identity or niche changes. */
function bustSiteCaches() {
  updateTag("sites");
  updateTag("homepage-pages");
  revalidatePath("/", "layout");
  revalidatePath("/panel/sites");
}

export async function createSite(input: SiteInput): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const host = cleanHost(input.host);
  const err = hostError(host);
  if (err) return { ok: false, error: err };
  if (!input.name.trim()) return { ok: false, error: "Nama situs tidak boleh kosong." };

  const supabase = await createClient();
  const { error } = await supabase.from("lp_sites").insert({
    host,
    name: input.name.trim(),
    tagline: input.tagline.trim() || null,
    category_ids: input.categoryIds,
    active: input.active,
    // Never through this form: the canonical site is the one that owns the panel
    // and the payment callback, and having two would be ambiguous.
    is_canonical: false,
  });

  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { ok: false, error: `Domain ${host} sudah terdaftar.` };
    }
    console.error("createSite error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  bustSiteCaches();
  return { ok: true };
}

export async function updateSite(
  id: string,
  input: SiteInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const host = cleanHost(input.host);
  const err = hostError(host);
  if (err) return { ok: false, error: err };
  if (!input.name.trim()) return { ok: false, error: "Nama situs tidak boleh kosong." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lp_sites")
    .update({
      host,
      name: input.name.trim(),
      tagline: input.tagline.trim() || null,
      category_ids: input.categoryIds,
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { ok: false, error: `Domain ${host} sudah dipakai situs lain.` };
    }
    console.error("updateSite error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  bustSiteCaches();
  return { ok: true };
}

/**
 * Deleting a site cascades to its lp_site_settings rows — its hero, popup,
 * tracking id and custom JS go with it. Products are untouched: they belong to
 * categories, not to sites.
 */
export async function deleteSite(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("lp_sites")
    .select("is_canonical")
    .eq("id", id)
    .maybeSingle();
  if (row?.is_canonical) {
    return {
      ok: false,
      error: "Domain utama tidak bisa dihapus — di situlah panel & callback pembayaran berada.",
    };
  }

  const { error } = await supabase.from("lp_sites").delete().eq("id", id);
  if (error) {
    console.error("deleteSite error:", error);
    return { ok: false, error: "Gagal menghapus." };
  }
  bustSiteCaches();
  return { ok: true };
}
