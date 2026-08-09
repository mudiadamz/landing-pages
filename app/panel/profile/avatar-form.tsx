"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadProfileAvatar, removeProfileAvatar } from "@/lib/actions/profiles";
import { FileUploadCard, type FileMeta } from "@/components/file-upload-card";

/**
 * The avatar control on /panel/profile — the same one for every role, since a
 * buyer, a publisher and an admin all land on this screen.
 *
 * FileUploadCard rather than a bare <input type="file">, per the panel rule: it
 * already owns the empty/filled states, the name and size line, replace and
 * remove, and the error slot.
 */
export function AvatarForm({
  initialUrl,
  initial,
}: {
  initialUrl: string;
  /** Letter shown while there is no picture — matches the sidebar's fallback. */
  initial: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Let the same file be picked again after a failure — without this the input
    // holds the old value and change never fires a second time.
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await uploadProfileAvatar(form);
    setUploading(false);

    if (res.ok && res.url) {
      setUrl(res.url);
      setMeta({ name: file.name, size: file.size });
      // The sidebar card renders the same picture from a server component.
      router.refresh();
    } else {
      setError(res.error ?? "Gagal mengunggah.");
    }
  }

  async function onRemove() {
    setError(null);
    setUploading(true);
    const res = await removeProfileAvatar();
    setUploading(false);
    if (res.ok) {
      setUrl("");
      setMeta(null);
      router.refresh();
    } else {
      setError(res.error ?? "Gagal menghapus.");
    }
  }

  return (
    <FileUploadCard
      label="Foto profil"
      accept="image/png,image/webp,image/jpeg"
      badge="Gambar"
      badgeClass="bg-[var(--accent-subtle)] text-[var(--primary)]"
      url={url}
      meta={meta}
      uploading={uploading}
      error={error}
      statusText={url ? "Foto terpasang" : "Belum ada foto"}
      hint="Persegi paling bagus. PNG · WebP · JPEG, maks 512 KB. Tanpa foto, inisial nama yang dipakai."
      preview={
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-subtle)] text-2xl font-semibold uppercase text-[var(--primary)]">
          {url ? (
            // Plain <img>: the URL is user-supplied and points at the storage
            // bucket, which next/image would need configured per host.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
      }
      onUpload={onUpload}
      onRemove={onRemove}
    />
  );
}
