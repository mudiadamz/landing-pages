"use client";

/**
 * Attachment uploads: browser → Supabase Storage, directly.
 *
 * The standalone app posted files as base64 inside the chat request. Base64 costs
 * a third more bytes and makes the app hold every attachment in memory just to
 * forward it, so instead the bytes go straight to the private `chat-attachments`
 * bucket and only the resulting PATHS travel in the chat request. Same reasoning,
 * and the same pattern, as `lib/upload-client.ts` for product files.
 *
 * Confinement to the uploader's own folder is a Storage RLS policy, not a check
 * here: this file runs in the browser, so nothing it does is a guarantee.
 */

import { createClient } from "@/lib/supabase/client";
import type { MessageKey } from "@/lib/i18n";

export type PendingFile = {
  file: File;
  name: string;
  mime: string;
  size: number;
  /** Object URL for an image, so the message shows the picture before it uploads. */
  previewUrl: string | null;
};

export type UploadedRef = { path: string; name: string; mime: string; size: number };

/**
 * The caller's translator, passed in rather than reached for.
 *
 * These are plain functions, not components, so `useT()` is not available — and a
 * module-level locale would be wrong for the usual reason: one server renders
 * every tenant at once.
 */
type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const MIME_BY_SUFFIX: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf",
  ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv",
  ".json": "application/json", ".html": "text/html", ".xml": "text/xml",
  ".py": "text/x-python", ".js": "text/javascript", ".ts": "text/plain",
  ".css": "text/css", ".yml": "text/plain", ".yaml": "text/plain",
  ".sql": "text/plain", ".sh": "text/plain", ".ini": "text/plain",
  ".log": "text/plain",
};

/**
 * The type the bucket will be told to store.
 *
 * The file picker leaves `type` empty for plenty of text formats (.md, .yml, .sql),
 * and an empty content type on a private object makes it undownloadable-looking
 * later. The extension is the better guess for exactly those cases.
 */
export function chatFileMime(file: File): string {
  if (file.type) return file.type;
  const dot = file.name.lastIndexOf(".");
  return (dot === -1 ? "" : MIME_BY_SUFFIX[file.name.slice(dot).toLowerCase()]) || "application/octet-stream";
}

export function toPendingFile(file: File): PendingFile {
  const mime = chatFileMime(file);
  return {
    file,
    name: file.name,
    mime,
    size: file.size,
    previewUrl: mime.startsWith("image/") ? URL.createObjectURL(file) : null,
  };
}

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);

/** Upload everything staged for one message. All or nothing, by design. */
export async function uploadChatFiles(
  files: PendingFile[],
  t: Translate,
): Promise<{ refs: UploadedRef[] } | { error: string }> {
  if (!files.length) return { refs: [] };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("chat.sessionExpired") };

  const refs: UploadedRef[] = [];
  for (const pending of files) {
    // Timestamped, so re-picking the same file is a new object rather than an
    // upsert (the bucket grants INSERT only, exactly as the download bucket does).
    const path = `${user.id}/chat/${Date.now()}-${safeName(pending.name)}`;
    const { error } = await supabase.storage
      .from("chat-attachments")
      .upload(path, pending.file, { contentType: pending.mime, upsert: false });
    if (error) return { error: t("chat.uploadFailed", { name: pending.name, reason: error.message }) };
    refs.push({ path, name: pending.name, mime: pending.mime, size: pending.size });
  }
  return { refs };
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
