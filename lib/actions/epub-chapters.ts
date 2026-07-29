"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limit";
import {
  listEpubChapters,
  readEpubChapter,
  writeEpubChapter,
  isSpinePath,
  type EpubChapterInfo,
} from "@/lib/epub-edit";

/**
 * Chapter-level editing of a product's EPUBs from the panel.
 *
 * A product can carry TWO different EPUBs and they are not copies of each other:
 * `preview_url` is the free sample (public bucket) and `story_epub_url` is the
 * full book a buyer downloads (private bucket). On this catalog the sample runs
 * short — 40 chapters against 63, 17 against 38 — so a chapter index in one does
 * not address the same chapter in the other. That is why the caller must name a
 * target and why nothing here tries to mirror an edit across both: it would
 * quietly rewrite the wrong chapter. Fix the typo in each, deliberately.
 *
 * Saving writes a NEW timestamped object and repoints the row, rather than
 * overwriting in place. Two reasons: /api/epub-text is edge-cached for a day
 * keyed on the file URL, so a new path is what makes the edit visible now
 * instead of tomorrow; and the previous file stays intact until the row has
 * been updated, so a failure mid-save cannot leave a product with no book.
 */

export type EpubTarget = "preview" | "deliverable";

const ASSETS_BUCKET = "landing-assets";
const DOWNLOADS_BUCKET = "landing-downloads";

function pathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

type Resolved = {
  userId: string;
  slug: string;
  /** Storage path of the current file. */
  path: string;
  bucket: string;
  /** Column on lp_landing_pages that points at it. */
  column: "preview_url" | "story_epub_url";
  /** The column stores a public URL (preview) or a bare path (deliverable). */
  stores: "url" | "path";
};

/**
 * Ownership check + locate the requested EPUB. Mirrors getLandingPageById's
 * guard (`user_id = auth.uid()` under RLS), so a seller can only ever reach
 * their own book.
 */
async function resolveTarget(
  pageId: string,
  target: EpubTarget,
): Promise<Resolved | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: page } = await supabase
    .from("lp_landing_pages")
    .select("slug, preview_type, preview_url, story_epub_url")
    .eq("id", pageId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!page) return { error: "Produk tidak ditemukan." };

  if (target === "deliverable") {
    const path = (page.story_epub_url as string | null)?.split("?")[0];
    if (!path) return { error: "Produk ini belum punya EPUB pembeli." };
    return {
      userId: user.id,
      slug: page.slug,
      path,
      bucket: DOWNLOADS_BUCKET,
      column: "story_epub_url",
      stores: "path",
    };
  }

  if (page.preview_type !== "epub" || !page.preview_url) {
    return { error: "Produk ini belum punya EPUB preview terpisah." };
  }
  const path = pathFromPublicUrl(page.preview_url as string, ASSETS_BUCKET);
  if (!path) return { error: "Lokasi file preview tidak dikenali." };
  return {
    userId: user.id,
    slug: page.slug,
    path,
    bucket: ASSETS_BUCKET,
    column: "preview_url",
    stores: "url",
  };
}

/** Download the archive with the service role — both buckets, one code path. */
async function downloadEpub(bucket: string, path: string): Promise<Uint8Array | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function getEpubChapters(
  pageId: string,
  target: EpubTarget,
): Promise<{ chapters: EpubChapterInfo[] } | { error: string }> {
  const t = await resolveTarget(pageId, target);
  if ("error" in t) return t;

  const bytes = await downloadEpub(t.bucket, t.path);
  if (!bytes) return { error: "File EPUB tidak bisa dibaca dari storage." };

  try {
    return { chapters: listEpubChapters(bytes) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "EPUB tidak terbaca." };
  }
}

export async function getEpubChapterSource(
  pageId: string,
  target: EpubTarget,
  chapterPath: string,
): Promise<{ html: string } | { error: string }> {
  const t = await resolveTarget(pageId, target);
  if ("error" in t) return t;

  const bytes = await downloadEpub(t.bucket, t.path);
  if (!bytes) return { error: "File EPUB tidak bisa dibaca dari storage." };

  try {
    const html = readEpubChapter(bytes, chapterPath);
    if (html === null) return { error: "Bab tidak ditemukan di file ini." };
    return { html };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "EPUB tidak terbaca." };
  }
}

export async function saveEpubChapter(
  pageId: string,
  target: EpubTarget,
  chapterPath: string,
  html: string,
): Promise<{ ok: true } | { error: string }> {
  const t = await resolveTarget(pageId, target);
  if ("error" in t) return t;

  const bytes = await downloadEpub(t.bucket, t.path);
  if (!bytes) return { error: "File EPUB tidak bisa dibaca dari storage." };

  let rebuilt: Uint8Array;
  try {
    // The path arrives from the browser; confirm it is a real spine entry rather
    // than trusting it to address, say, the OPF or a stylesheet.
    if (!isSpinePath(bytes, chapterPath)) return { error: "Bab tidak dikenali." };
    rebuilt = writeEpubChapter(bytes, chapterPath, html);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menulis ulang EPUB." };
  }

  if (rebuilt.byteLength > MAX_UPLOAD_BYTES) {
    return { error: `Ukuran EPUB hasil edit melebihi ${MAX_UPLOAD_LABEL}.` };
  }

  const admin = createAdminClient();
  const name = t.path.split("/").pop() || "book.epub";
  const newPath = `${t.path.split("/").slice(0, -1).join("/")}/${Date.now()}-${name.replace(/^\d+-/, "")}`;

  const { error: upErr } = await admin.storage.from(t.bucket).upload(
    newPath,
    // Buffer keeps supabase-js from treating a Uint8Array as a stream.
    Buffer.from(rebuilt),
    { contentType: "application/epub+zip", upsert: true },
  );
  if (upErr) return { error: upErr.message };

  const value =
    t.stores === "url"
      ? admin.storage.from(t.bucket).getPublicUrl(newPath).data.publicUrl
      : newPath;

  const { error: dbErr } = await admin
    .from("lp_landing_pages")
    .update({ [t.column]: value })
    .eq("id", pageId)
    .eq("user_id", t.userId);

  if (dbErr) {
    // Roll back the orphan so a failed save doesn't leave storage littered.
    await admin.storage.from(t.bucket).remove([newPath]).catch(() => {});
    return { error: dbErr.message };
  }

  // Only now is the old file unreferenced.
  if (t.path.startsWith(`${t.userId}/`)) {
    await admin.storage.from(t.bucket).remove([t.path]).catch(() => {});
  }

  revalidatePath(`/panel/product/${pageId}/epub`);
  revalidatePath(`/panel/product/${pageId}/edit`);
  revalidatePath(`/lp/${t.slug}`);
  revalidatePath(`/read/${t.slug}`);

  return { ok: true };
}
