"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSellProducts } from "@/lib/actions/profiles";
import { extractEpubMeta, readEpubFile, IMG_MIME } from "@/lib/epub-server";
import { slugFromTitle, isValidSlug } from "@/lib/slug";

const DOWNLOADS = "landing-downloads";
const ASSETS = "landing-assets";

/** How much of the book the free preview shows. */
const PREVIEW_PERCENT = 70;

/**
 * Create a product from an EPUB alone.
 *
 * The long form asks for a title, a slug, a description, a thumbnail, a preview
 * source and a deliverable — six answers a book already contains. This asks for
 * the three it does not: which shelf, what price, and the file itself.
 *
 * The file is uploaded straight to Storage by the browser BEFORE this runs and
 * only its path arrives here, because a Server Action body is capped at ~4.5 MB
 * on Vercel and a book routinely exceeds that. The path is re-derived from the
 * session's user id, never trusted from the form, so this cannot be pointed at
 * another seller's object.
 *
 * Everything it fills in is editable afterwards in the full form — this is a
 * faster on-ramp, not a separate kind of product.
 */
export async function createProductFromEpub(input: {
  /** Storage path in landing-downloads, from uploadNewEpubClient. */
  epubPath: string;
  categoryId?: string | null;
  /** Rupiah. 0 (or free) publishes it as a free download. */
  price?: number;
  isFree?: boolean;
}): Promise<{ ok: true; id: string; slug: string } | { ok: false; error: string }> {
  if (!(await canSellProducts())) return { ok: false, error: "Akses ditolak." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Belum masuk." };

  const path = (input.epubPath ?? "").trim();
  // The only thing standing between a form field and someone else's book.
  if (!path.startsWith(`${user.id}/`) || path.includes("..")) {
    return { ok: false, error: "Berkas tidak dikenali." };
  }

  const admin = createAdminClient();
  const { data: blob, error: dlErr } = await admin.storage.from(DOWNLOADS).download(path);
  if (dlErr || !blob) return { ok: false, error: "Gagal membaca berkas EPUB." };

  const bytes = new Uint8Array(await blob.arrayBuffer());

  let meta;
  try {
    meta = extractEpubMeta(bytes);
  } catch {
    return { ok: false, error: "File ini tidak terbaca sebagai EPUB." };
  }

  const title = meta.title.trim() || "Buku tanpa judul";

  // Slug from the title, with a numeric suffix when the shelf already has one.
  // Checked against every seller's products, not just this one's: the slug is
  // the public URL and it is global.
  const base = slugFromTitle(title) || "buku";
  let slug = base;
  for (let n = 2; n < 60; n++) {
    const { data: clash } = await admin
      .from("lp_landing_pages")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${base}-${n}`;
  }
  if (!isValidSlug(slug)) return { ok: false, error: "Judul tidak bisa dijadikan URL." };

  // Cover -> thumbnail. A book without one still becomes a product; the seller
  // adds a thumbnail in the full form.
  let thumbnailUrl: string | null = null;
  if (meta.coverPath) {
    const cover = readEpubFile(bytes, meta.coverPath);
    if (cover) {
      const ext = meta.coverPath.split(".").pop()?.toLowerCase() ?? "jpg";
      const contentType = IMG_MIME[ext] ?? "image/jpeg";
      const coverPath = `${user.id}/covers/${Date.now()}-${slug}.${ext}`;
      const { error } = await admin.storage
        .from(ASSETS)
        .upload(coverPath, cover, { contentType, upsert: false });
      if (!error) {
        thumbnailUrl = admin.storage.from(ASSETS).getPublicUrl(coverPath).data.publicUrl;
      }
    }
  }

  const price = Math.max(0, Math.round(input.price ?? 0));
  const isFree = !!input.isFree || price <= 0;

  const { data, error } = await admin
    .from("lp_landing_pages")
    .insert({
      title,
      slug,
      // The reader renders the book; there is no HTML page to author.
      html_content: "",
      long_description: meta.description || null,
      thumbnail_url: thumbnailUrl,
      category_id: input.categoryId?.trim() || null,
      price: isFree ? 0 : price,
      is_free: isFree,
      // The buyer's file IS the preview, cut at 70% — one upload doing both
      // jobs, which is the whole point of the short form.
      story_epub_url: path,
      preview_type: "excerpt",
      preview_cut_percent: PREVIEW_PERCENT,
      user_id: user.id,
      // A draft, like every other new product: the seller checks the derived
      // title and blurb before anyone sees them.
      published: false,
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    console.error("createProductFromEpub insert error:", error);
    return { ok: false, error: "Gagal membuat produk." };
  }

  revalidatePath("/panel/products");
  return { ok: true, id: data.id, slug: data.slug };
}
