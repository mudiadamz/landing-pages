"use client";

/**
 * Client-side, direct-to-Storage uploads for the product form. Files go straight
 * from the browser to Supabase Storage (owner-scoped RLS), NOT through a Server
 * Action. Only the resulting URL/path is later saved to the DB (a tiny payload).
 *
 * This started as a workaround for a hosting limit that no longer exists (a
 * ~4.5 MB request body cap). It stays because the shape is better on its own
 * terms: a 40 MB EPUB sent through an action crosses the network twice — browser
 * to app, app to Storage — and the app has to hold the whole thing in memory
 * while it does. So do not "simplify" this back into the action just because
 * `serverActions.bodySizeLimit` in next.config.ts is now 50 MB; that limit is no
 * longer what decides it.
 *
 * Public bucket (assets) uploads return a public URL; private bucket (downloads)
 * uploads return the storage path (the download route signs it).
 */
import { createClient } from "@/lib/supabase/client";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limit";
import { imageUploadLimit } from "@/lib/actions/profiles";

const ASSETS = "landing-assets";
const DOWNLOADS = "landing-downloads";

export type UploadResult = { url: string } | { error: string };

const clean = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, "_");

function assetPathFromUrl(url: string): string | null {
  const marker = `/object/public/${ASSETS}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

async function session() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, uid: user?.id ?? null };
}

const tooBig = (file: File) => (file.size > MAX_UPLOAD_BYTES ? `Ukuran file melebihi ${MAX_UPLOAD_LABEL}.` : null);

async function uploadPublic(
  pageId: string,
  file: File,
  subdir: string,
  contentType: string,
  previousUrl?: string | null,
): Promise<UploadResult> {
  const { supabase, uid } = await session();
  if (!uid) return { error: "Unauthorized" };
  const dir = subdir ? `${uid}/${pageId}/${subdir}` : `${uid}/${pageId}`;
  const path = `${dir}/${Date.now()}-${clean(file.name)}`;

  // upsert:false → a plain INSERT. Paths are unique (timestamped), so there's no
  // conflict; upsert would need an UPDATE RLS policy the buckets don't grant.
  const { error } = await supabase.storage.from(ASSETS).upload(path, file, { contentType, upsert: false });
  if (error) return { error: error.message };

  if (previousUrl) {
    const prev = assetPathFromUrl(previousUrl) ?? previousUrl.split("?")[0];
    if (prev && prev !== path && prev.startsWith(`${uid}/`)) {
      await supabase.storage.from(ASSETS).remove([prev]).catch(() => {});
    }
  }
  const { data } = supabase.storage.from(ASSETS).getPublicUrl(path);
  return { url: data.publicUrl };
}

async function uploadPrivate(
  pageId: string,
  file: File,
  subdir: string,
  contentType: string,
  previousPath?: string | null,
): Promise<UploadResult> {
  const { supabase, uid } = await session();
  if (!uid) return { error: "Unauthorized" };
  const dir = subdir ? `${uid}/${pageId}/${subdir}` : `${uid}/${pageId}`;
  const path = `${dir}/${Date.now()}-${clean(file.name)}`;

  // upsert:false → plain INSERT (landing-downloads has no UPDATE policy, so an
  // upsert's ON CONFLICT DO UPDATE would violate RLS). Paths are unique anyway.
  const { error } = await supabase.storage.from(DOWNLOADS).upload(path, file, { contentType, upsert: false });
  if (error) return { error: error.message };

  if (previousPath) {
    const prev = previousPath.split("?")[0];
    if (prev && prev !== path && prev.startsWith(`${uid}/`)) {
      await supabase.storage.from(DOWNLOADS).remove([prev]).catch(() => {});
    }
  }
  return { url: path }; // path, not URL
}

const isPdf = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
const isEpub = (f: File) => f.type === "application/epub+zip" || f.name.toLowerCase().endsWith(".epub");
const isZip = (f: File) => !!f.type?.includes("zip") || f.name.toLowerCase().endsWith(".zip");

/* ---- Preview source (public bucket) ---- */
export async function uploadPreviewPdfClient(pageId: string, file: File, previousUrl?: string | null): Promise<UploadResult> {
  const big = tooBig(file);
  if (big) return { error: big };
  if (!isPdf(file)) return { error: "Hanya file PDF yang diperbolehkan." };
  return uploadPublic(pageId, file, "preview", "application/pdf", previousUrl);
}
export async function uploadPreviewEpubClient(pageId: string, file: File, previousUrl?: string | null): Promise<UploadResult> {
  const big = tooBig(file);
  if (big) return { error: big };
  if (!isEpub(file)) return { error: "Hanya file EPUB yang diperbolehkan." };
  return uploadPublic(pageId, file, "preview", "application/epub+zip", previousUrl);
}
export async function uploadThumbnailClient(pageId: string, file: File, previousUrl?: string | null): Promise<UploadResult> {
  if (file.type && !file.type.startsWith("image/")) return { error: "File harus berupa gambar." };
  // The cap comes from the server, not from a constant compiled into the bundle:
  // it depends on whether this user is an admin, and that is not the browser's
  // to decide. The file itself goes straight to Storage, so this check is the
  // UI's — a Storage policy would be what stops a crafted request.
  const { bytes, label } = await imageUploadLimit();
  if (file.size > bytes) return { error: `Ukuran file melebihi ${label}.` };
  return uploadPublic(pageId, file, "", file.type || "application/octet-stream", previousUrl);
}

/**
 * The EPUB for a product that does not exist yet.
 *
 * Every other upload here is keyed by pageId, but the short form has no page
 * until the file has been read — so this parks the book under the seller's own
 * `_new/` prefix and hands the path to createProductFromEpub, which stores it as
 * the product's deliverable exactly where it landed. RLS still scopes the write
 * to the caller's own folder.
 */
export async function uploadNewEpubClient(file: File): Promise<UploadResult> {
  const big = tooBig(file);
  if (big) return { error: big };
  if (!isEpub(file)) return { error: "Hanya file EPUB yang diizinkan" };

  const { supabase, uid } = await session();
  if (!uid) return { error: "Unauthorized" };

  const path = `${uid}/_new/${Date.now()}-${clean(file.name)}`;
  const { error } = await supabase.storage
    .from(DOWNLOADS)
    .upload(path, file, { contentType: "application/epub+zip", upsert: false });
  if (error) return { error: error.message };
  return { url: path };
}

/* ---- Deliverables (private bucket) ---- */
export async function uploadZipClient(pageId: string, file: File, previousPath?: string | null): Promise<UploadResult> {
  const big = tooBig(file);
  if (big) return { error: big };
  if (!isZip(file)) return { error: "Hanya file ZIP yang diizinkan" };
  return uploadPrivate(pageId, file, "", "application/zip", previousPath);
}
export async function uploadStoryPdfClient(pageId: string, file: File, previousPath?: string | null): Promise<UploadResult> {
  const big = tooBig(file);
  if (big) return { error: big };
  if (!isPdf(file)) return { error: "Hanya file PDF yang diizinkan" };
  return uploadPrivate(pageId, file, "story", "application/pdf", previousPath);
}
export async function uploadStoryEpubClient(pageId: string, file: File, previousPath?: string | null): Promise<UploadResult> {
  const big = tooBig(file);
  if (big) return { error: big };
  if (!isEpub(file)) return { error: "Hanya file EPUB yang diizinkan" };
  return uploadPrivate(pageId, file, "story", "application/epub+zip", previousPath);
}
