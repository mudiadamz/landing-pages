"use server";

import { unstable_cache, revalidateTag, revalidatePath } from "next/cache";
import { createAnonClient } from "@/lib/db/anon";
import { createAdminClient } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/actions/profiles";
import { currentSiteId } from "@/lib/site-resolve";
import { slugFromTitle, isValidSlug } from "@/lib/slug";
import { sanitizePageHtml } from "@/lib/page-html";
import type { EditorialPage, EditorialPageSummary } from "@/lib/page-types";

/**
 * Editorial pages — "Tentang kami" and anything else a storefront wants that is
 * not a product and not one of the fixed legal pages.
 *
 * Rows, not settings: these have their own URLs and are created and deleted by a
 * person, so they cannot live in the key/value blob that holds surfaces the code
 * already knows the names of.
 */

/** Published pages for the public site, in footer order. */
const readPublishedPages = unstable_cache(
  async (siteId: string): Promise<EditorialPageSummary[]> => {
    try {
      const db = createAnonClient();
      const { data } = await db
        .from("lp_pages")
        .select("id, slug, title, sort_order")
        .eq("site_id", siteId)
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });
      return (data ?? []) as EditorialPageSummary[];
    } catch {
      return [];
    }
  },
  ["editorial-pages"],
  { revalidate: 120, tags: ["editorial-pages"] },
);

export async function getPublishedPages(siteId?: string): Promise<EditorialPageSummary[]> {
  return readPublishedPages(siteId ?? (await currentSiteId()));
}

/** One published page for the public route. Null when missing or still a draft. */
export async function getPublishedPage(slug: string): Promise<EditorialPage | null> {
  const siteId = await currentSiteId();
  const db = createAnonClient();
  const { data } = await db
    .from("lp_pages")
    .select("id, site_id, slug, title, content, published, sort_order")
    .eq("site_id", siteId)
    .eq("slug", slug.trim().toLowerCase())
    .eq("published", true)
    .maybeSingle();
  return (data as EditorialPage) ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Panel                                                                      */
/* -------------------------------------------------------------------------- */

/** Every page for the current storefront, drafts included. */
export async function listPages(): Promise<EditorialPageSummary[]> {
  if (!(await requireAdmin())) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_pages")
    .select("id, slug, title, sort_order, published")
    .eq("site_id", await currentSiteId())
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  return (data ?? []) as EditorialPageSummary[];
}

export async function getPageForEdit(id: string): Promise<EditorialPage | null> {
  if (!(await requireAdmin())) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_pages")
    .select("id, site_id, slug, title, content, published, sort_order")
    // Scoped to this storefront as well as this id: an admin of one site should
    // not reach another site's page by pasting its uuid.
    .eq("site_id", await currentSiteId())
    .eq("id", id)
    .maybeSingle();
  return (data as EditorialPage) ?? null;
}

export async function createPage(
  title: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const clean = title.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Judul wajib diisi." };

  const siteId = await currentSiteId();
  const admin = createAdminClient();

  // Unique per site, so the suffix search is scoped the same way.
  const base = slugFromTitle(clean) || "halaman";
  let slug = base;
  for (let n = 2; n < 60; n++) {
    const { data: clash } = await admin
      .from("lp_pages")
      .select("id")
      .eq("site_id", siteId)
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${base}-${n}`;
  }
  if (!isValidSlug(slug)) return { ok: false, error: "Judul tidak bisa dijadikan URL." };

  const { data, error } = await admin
    .from("lp_pages")
    .insert({ site_id: siteId, slug, title: clean, content: "", published: false })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createPage error:", error);
    return { ok: false, error: "Gagal membuat halaman." };
  }
  revalidateTag("editorial-pages", "max");
  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}

export async function savePage(input: {
  id: string;
  title: string;
  slug: string;
  content: string;
  published: boolean;
  sortOrder: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const title = input.title.trim().slice(0, 120);
  const slug = input.slug.trim().toLowerCase();
  if (!title) return { ok: false, error: "Judul wajib diisi." };
  if (!isValidSlug(slug)) {
    return { ok: false, error: "URL hanya boleh huruf kecil, angka, dan tanda hubung." };
  }

  const siteId = await currentSiteId();
  const admin = createAdminClient();

  const { data: clash } = await admin
    .from("lp_pages")
    .select("id")
    .eq("site_id", siteId)
    .eq("slug", slug)
    .neq("id", input.id)
    .maybeSingle();
  if (clash) return { ok: false, error: "URL itu sudah dipakai halaman lain." };

  const { error } = await admin
    .from("lp_pages")
    .update({
      title,
      slug,
      // Sanitised on write, not on render: the page is read far more often than
      // it is saved, and a stored script is a thing that exists whether or not
      // today's renderer happens to strip it.
      content: sanitizePageHtml(input.content),
      published: !!input.published,
      sort_order: Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0,
      updated_at: new Date().toISOString(),
    })
    .eq("site_id", siteId)
    .eq("id", input.id);

  if (error) {
    console.error("savePage error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  revalidateTag("editorial-pages", "max");
  revalidatePath("/", "layout");
  revalidatePath(`/p/${slug}`);
  return { ok: true };
}

export async function deletePage(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("lp_pages")
    .delete()
    .eq("site_id", await currentSiteId())
    .eq("id", id);
  if (error) {
    console.error("deletePage error:", error);
    return { ok: false, error: "Gagal menghapus." };
  }
  revalidateTag("editorial-pages", "max");
  revalidatePath("/", "layout");
  return { ok: true };
}
