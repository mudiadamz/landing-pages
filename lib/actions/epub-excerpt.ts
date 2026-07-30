"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildEpubExcerpt } from "@/lib/epub-edit";

/**
 * Generate the free preview by cutting the deliverable EPUB.
 *
 * Why a stored file rather than cutting on the fly: the preview is the page ad
 * traffic lands on, and the reader already fetches its chapters over the network.
 * Truncating per request would put an unzip on the critical path of the one page
 * this project cannot afford to slow down. Cutting once at save time keeps the
 * serve path exactly what it already is — a plain EPUB at a public URL — so
 * nothing downstream (reader, cache, chapter editor) needs to know it was
 * generated.
 *
 * The deliverable lives in the PRIVATE bucket and the preview in the public one,
 * which is the whole point: the excerpt is a different file that physically does
 * not contain the withheld chapters. A page-limit enforced in the reader would
 * ship the ending to the browser and ask it not to look.
 *
 * Regeneration is explicit, not automatic. Editing chapter 2 of a book does not
 * silently republish the preview — sellers proof-read the excerpt, and a preview
 * that changes under them without a click is worse than a stale one.
 */

const PREVIEW_BUCKET = "landing-assets";
const DELIVERABLE_BUCKET = "landing-downloads";

export type ExcerptResult =
  | {
      ok: true;
      url: string;
      keptChapters: number;
      totalChapters: number;
      keptPercent: number;
      excerptBytes: number;
      lastChapterTitle: string;
    }
  | { ok: false; error: string };

export async function generateExcerptPreview(
  pageId: string,
  cutPercent: number,
): Promise<ExcerptResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // Ownership via the RLS client — a seller may only cut their own book.
  const { data: page } = await supabase
    .from("lp_landing_pages")
    .select("id, user_id, story_epub_url, preview_url")
    .eq("id", pageId)
    .single();
  if (!page) return { ok: false, error: "Produk tidak ditemukan." };
  if (!page.story_epub_url) {
    return { ok: false, error: "Belum ada file EPUB pembeli untuk dipotong." };
  }

  const admin = createAdminClient();
  const { data: blob, error: dlError } = await admin.storage
    .from(DELIVERABLE_BUCKET)
    .download(page.story_epub_url);
  if (dlError || !blob) {
    return { ok: false, error: "Gagal membaca file EPUB pembeli." };
  }

  let built;
  try {
    built = buildEpubExcerpt(new Uint8Array(await blob.arrayBuffer()), cutPercent);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? `EPUB tidak bisa dipotong: ${e.message}` : "EPUB tidak bisa dipotong.",
    };
  }

  // Timestamped path, like every other upload here: the public URL is what busts
  // the CDN, so a new cut must not reuse the old name.
  const path = `${page.user_id}/${pageId}/preview/${Date.now()}-excerpt.epub`;
  const { error: upError } = await admin.storage
    .from(PREVIEW_BUCKET)
    .upload(path, built.bytes, { contentType: "application/epub+zip", upsert: false });
  if (upError) return { ok: false, error: "Gagal menyimpan preview." };

  const { data: urlData } = admin.storage.from(PREVIEW_BUCKET).getPublicUrl(path);
  const url = urlData.publicUrl;

  const { error: rowError } = await supabase
    .from("lp_landing_pages")
    .update({ preview_type: "excerpt", preview_url: url })
    .eq("id", pageId);
  if (rowError) {
    await admin.storage.from(PREVIEW_BUCKET).remove([path]);
    return { ok: false, error: "Gagal memperbarui produk." };
  }

  // Drop the file the preview used to point at. Only after the row is committed:
  // deleting first would leave a live product pointing at nothing if the update
  // failed.
  const prev = page.preview_url;
  if (prev && prev !== url) {
    const marker = `/${PREVIEW_BUCKET}/`;
    const at = prev.indexOf(marker);
    if (at !== -1) {
      const prevPath = prev.slice(at + marker.length).split("?")[0];
      if (prevPath.startsWith(`${page.user_id}/`)) {
        await admin.storage.from(PREVIEW_BUCKET).remove([prevPath]);
      }
    }
  }

  revalidatePath(`/panel/product/${pageId}/edit`);
  revalidatePath(`/panel/product/${pageId}/epub`);

  return {
    ok: true,
    url,
    keptChapters: built.keptChapters,
    totalChapters: built.totalChapters,
    keptPercent: Math.round((built.keptChars / built.totalChars) * 100),
    excerptBytes: built.excerptBytes,
    lastChapterTitle: built.keptTitles.at(-1) ?? "",
  };
}
