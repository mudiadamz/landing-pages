"use server";

import { unzipSync } from "fflate";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "landing-assets";

export async function uploadAsset(
  pageId: string,
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided" };

  const allowed = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "video/mp4", "video/webm", "video/ogg",
  ];
  if (!allowed.includes(file.type)) {
    return { error: "File type not allowed. Use images (jpg, png, gif, webp, svg) or videos (mp4, webm, ogg)." };
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${pageId}/${Date.now()}-${sanitized}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return { error: error.message };

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: urlData.publicUrl };
}

/**
 * Independent, page-agnostic media library scoped to the current user
 * (`<user>/_library/...`). Powers the reusable Assets popup that can be opened
 * from anywhere (e.g. the panel sidebar) without a landing-page context.
 */
const LIBRARY_FOLDER = "_library";

export async function uploadLibraryAsset(
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided" };

  const allowed = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "video/mp4", "video/webm", "video/ogg",
  ];
  if (!allowed.includes(file.type)) {
    return { error: "File type not allowed. Use images (jpg, png, gif, webp, svg) or videos (mp4, webm, ogg)." };
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${LIBRARY_FOLDER}/${Date.now()}-${sanitized}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { error: error.message };

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: urlData.publicUrl };
}

export async function listLibraryAssets(): Promise<{ name: string; url: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(`${user.id}/${LIBRARY_FOLDER}`, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error || !data) return [];

  const results: { name: string; url: string }[] = [];
  for (const f of data) {
    if (f.id && f.name && !f.name.startsWith(".")) {
      const path = `${user.id}/${LIBRARY_FOLDER}/${f.name}`;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      results.push({ name: f.name, url: urlData.publicUrl });
    }
  }
  return results;
}

export async function listAssets(pageId: string): Promise<{ name: string; url: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(`${user.id}/${pageId}`, { limit: 50 });

  if (error || !data) return [];

  const results: { name: string; url: string }[] = [];
  for (const f of data) {
    // Skip folder placeholders (e.g. the "site" folder from a ZIP upload) and
    // hidden files — only show directly-uploaded image/video assets here.
    if (f.id && f.name && !f.name.startsWith(".")) {
      const path = `${user.id}/${pageId}/${f.name}`;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      results.push({ name: f.name, url: urlData.publicUrl });
    }
  }
  return results;
}

/**
 * Upload a full static site bundled as a ZIP. Every file/folder is uploaded to
 * `<user>/<page>/site/...` preserving structure, and the bundle's index.html
 * becomes the page's preview HTML (with a <base href> injected so its relative
 * asset references resolve to storage).
 */
export async function uploadSiteZip(
  pageId: string,
  formData: FormData
): Promise<
  | { html: string; fileCount: number; indexPath: string }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Confirm the caller owns this page before writing anything.
  const { data: page } = await supabase
    .from("lp_landing_pages")
    .select("id")
    .eq("id", pageId)
    .eq("user_id", user.id)
    .single();
  if (!page) return { error: "Landing page not found" };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return { error: "Please upload a .zip file." };
  }

  let entries: Record<string, Uint8Array>;
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    entries = unzipSync(buf);
  } catch {
    return { error: "Could not read the ZIP file. Make sure it is a valid ZIP archive." };
  }

  // Keep real files only; drop directory entries, OS junk and path traversal.
  let files: { path: string; data: Uint8Array }[] = [];
  for (const [rawPath, data] of Object.entries(entries)) {
    if (rawPath.endsWith("/")) continue;
    const norm = rawPath.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!norm) continue;
    const segs = norm.split("/");
    if (segs.some((s) => s === "" || s === "..")) continue;
    if (segs.includes("__MACOSX")) continue;
    const base = segs[segs.length - 1];
    if (base === ".DS_Store" || base === "Thumbs.db") continue;
    files.push({ path: norm, data });
  }
  if (files.length === 0) return { error: "The ZIP appears to be empty." };

  // If the archive wraps everything in a single top-level folder (e.g. zipping
  // a folder rather than its contents), strip it so index.html sits at root.
  const topSegs = new Set(files.map((f) => f.path.split("/")[0]));
  if (topSegs.size === 1) {
    const only = [...topSegs][0];
    const allNested = files.every((f) => f.path.startsWith(`${only}/`));
    if (allNested) {
      files = files.map((f) => ({ path: f.path.slice(only.length + 1), data: f.data }));
    }
  }

  // Locate index.html, preferring the shallowest match.
  const indexFile = files
    .filter((f) => f.path.split("/").pop()?.toLowerCase() === "index.html")
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0];
  if (!indexFile) {
    return { error: "No index.html found in the ZIP." };
  }
  const indexDir = indexFile.path.includes("/")
    ? indexFile.path.slice(0, indexFile.path.lastIndexOf("/"))
    : "";

  // Upload every file under <user>/<page>/site/<path> (bounded concurrency).
  const prefix = `${user.id}/${pageId}/site`;
  const CONCURRENCY = 8;
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const chunk = files.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((f) => {
        const ext = f.path.split(".").pop()?.toLowerCase() || "";
        const blob = new Blob([f.data as BlobPart], { type: getMimeType(ext) });
        return supabase.storage.from(BUCKET).upload(`${prefix}/${f.path}`, blob, {
          contentType: getMimeType(ext),
          upsert: true,
        });
      })
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      return { error: `Upload failed: ${failed.error.message}` };
    }
  }

  // <base href> = the storage directory that holds index.html, so the page's
  // relative references (images/…, fonts/…, css/…) resolve to storage.
  const baseDir = indexDir ? `${prefix}/${indexDir}` : prefix;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(baseDir);
  const baseHref = urlData.publicUrl.replace(/\/?$/, "/");

  const indexHtml = new TextDecoder().decode(indexFile.data);
  const html = injectBaseHref(indexHtml, baseHref);

  const { error: updErr } = await supabase
    .from("lp_landing_pages")
    .update({ html_content: html })
    .eq("id", pageId)
    .eq("user_id", user.id);
  if (updErr) return { error: updErr.message };

  revalidatePath("/panel");
  revalidatePath(`/panel/landing-pages/${pageId}/edit`);

  return { html, fileCount: files.length, indexPath: indexFile.path };
}

/**
 * Upload a PDF to use as the landing page preview. Stored under
 * `<user>/<page>/preview/<file>` and returns its public URL — the caller
 * persists it via updateLandingPageSettings(preview_type: 'pdf').
 */
export async function uploadPreviewPdf(
  pageId: string,
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Hanya file PDF yang diperbolehkan." };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { error: "Ukuran PDF melebihi 25 MB." };
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${pageId}/preview/${Date.now()}-${sanitized}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) return { error: error.message };

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: urlData.publicUrl };
}

/** Insert (replacing any existing) a <base href> at the top of the document head. */
function injectBaseHref(html: string, baseHref: string): string {
  const tag = `<base href="${baseHref}">`;
  const without = html.replace(/<base\b[^>]*>/gi, "");
  if (/<head[^>]*>/i.test(without)) {
    return without.replace(/<head[^>]*>/i, (m) => `${m}\n  ${tag}`);
  }
  if (/<html[^>]*>/i.test(without)) {
    return without.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n  ${tag}\n</head>`);
  }
  return `${tag}\n${without}`;
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "text/javascript",
    mjs: "text/javascript",
    json: "application/json",
    xml: "application/xml",
    txt: "text/plain",
    csv: "text/csv",
    map: "application/json",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    bmp: "image/bmp",
    mp4: "video/mp4",
    webm: "video/webm",
    ogg: "video/ogg",
    ogv: "video/ogg",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    eot: "application/vnd.ms-fontobject",
    pdf: "application/pdf",
    webmanifest: "application/manifest+json",
  };
  return map[ext] || "application/octet-stream";
}
