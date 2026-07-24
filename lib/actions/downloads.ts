"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limit";

const BUCKET = "landing-downloads";

/**
 * Best-effort delete of a deliverable file being replaced. Values stored for the
 * deliverable are storage paths (private bucket). Only removes the caller's own
 * object and never the just-uploaded file; failures are swallowed.
 */
async function removePreviousDownload(
  admin: ReturnType<typeof createAdminClient>,
  previousPath: string | null | undefined,
  userId: string,
  newPath: string,
) {
  if (!previousPath) return;
  const path = previousPath.split("?")[0];
  if (!path || path === newPath || !path.startsWith(`${userId}/`)) return;
  try {
    await admin.storage.from(BUCKET).remove([path]);
  } catch {
    /* ignore cleanup errors */
  }
}

export async function uploadZip(
  pageId: string,
  formData: FormData,
  previousPath?: string | null,
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file) return { error: "Tidak ada file" };

  if (!file.type?.includes("zip") && !file.name.toLowerCase().endsWith(".zip")) {
    return { error: "Hanya file ZIP yang diizinkan" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `Ukuran ZIP melebihi ${MAX_UPLOAD_LABEL}.` };
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${pageId}/${Date.now()}-${sanitized}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: "application/zip",
    upsert: true,
  });

  if (error) return { error: error.message };

  // Replacing the deliverable: delete the previous file.
  await removePreviousDownload(admin, previousPath, user.id, path);

  return { url: path };
}

export async function uploadStoryPdf(
  pageId: string,
  formData: FormData,
  previousPath?: string | null,
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file) return { error: "Tidak ada file" };

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Hanya file PDF yang diizinkan" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `Ukuran PDF maksimal ${MAX_UPLOAD_LABEL}` };
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${pageId}/story/${Date.now()}-${sanitized}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (error) return { error: error.message };

  // Replacing the deliverable: delete the previous file.
  await removePreviousDownload(admin, previousPath, user.id, path);

  return { url: path };
}

/**
 * Upload the EPUB deliverable a buyer receives. Private bucket (admin client),
 * mirroring uploadStoryPdf; the buyer reads it through a gated signed URL.
 */
export async function uploadStoryEpub(
  pageId: string,
  formData: FormData,
  previousPath?: string | null,
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file) return { error: "Tidak ada file" };

  const okType =
    file.type === "application/epub+zip" || file.name.toLowerCase().endsWith(".epub");
  if (!okType) return { error: "Hanya file EPUB yang diizinkan" };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `Ukuran EPUB maksimal ${MAX_UPLOAD_LABEL}` };
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${pageId}/story/${Date.now()}-${sanitized}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: "application/epub+zip",
    upsert: true,
  });
  if (error) return { error: error.message };

  await removePreviousDownload(admin, previousPath, user.id, path);
  return { url: path };
}

export async function getSignedDownloadUrl(storagePath: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
