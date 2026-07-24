"use client";

/**
 * Client-side, direct-to-Storage uploads for the product form. Files go straight
 * from the browser to Supabase Storage (owner-scoped RLS), NOT through a Server
 * Action — Server Actions on Vercel cap the request body at ~4.5 MB
 * (FUNCTION_PAYLOAD_TOO_LARGE), which a book cover/EPUB easily exceeds. Only the
 * resulting URL/path is later saved to the DB (a tiny payload).
 *
 * Public bucket (assets) uploads return a public URL; private bucket (downloads)
 * uploads return the storage path (the download route signs it).
 */
import { createClient } from "@/lib/supabase/client";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limit";

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

  const { error } = await supabase.storage.from(ASSETS).upload(path, file, { contentType, upsert: true });
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

  const { error } = await supabase.storage.from(DOWNLOADS).upload(path, file, { contentType, upsert: true });
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
  const big = tooBig(file);
  if (big) return { error: big };
  if (file.type && !file.type.startsWith("image/")) return { error: "File harus berupa gambar." };
  return uploadPublic(pageId, file, "", file.type || "application/octet-stream", previousUrl);
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
