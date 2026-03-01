"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "landing-downloads";

export async function uploadZip(
  pageId: string,
  formData: FormData
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

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${pageId}/${Date.now()}-${sanitized}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: "application/zip",
    upsert: true,
  });

  if (error) return { error: error.message };

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
