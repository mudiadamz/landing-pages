"use server";

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

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
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
    if (f.name && !f.name.startsWith(".")) {
      const path = `${user.id}/${pageId}/${f.name}`;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      results.push({ name: f.name, url: urlData.publicUrl });
    }
  }
  return results;
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    ogg: "video/ogg",
  };
  return map[ext] || "application/octet-stream";
}
