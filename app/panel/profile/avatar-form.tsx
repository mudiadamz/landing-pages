"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { uploadProfileAvatar, removeProfileAvatar } from "@/lib/actions/profiles";
import { FileUploadCard, type FileMeta } from "@/components/file-upload-card";

/**
 * The avatar, and the popup for changing it — one component, because the
 * trigger IS the picture.
 *
 * The photo in the identity header is the control: tapping the thing you want
 * to change is where everyone tries first, and it saves the page a second card
 * repeating the same picture underneath. The popup keeps FileUploadCard, per the
 * panel rule, so replace/remove/errors behave as they do everywhere else.
 *
 * Same control for every role — a buyer, a publisher and an admin all land on
 * this screen.
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
  const [open, setOpen] = useState(false);

  // Esc closes, and the page behind stops scrolling while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

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

  const picture = url ? (
    // Plain <img>: the URL is user-supplied and points at the storage bucket,
    // which next/image would need configured per host.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-full w-full object-cover" />
  ) : (
    initial
  );

  return (
    <>
      {/* The picture, as a button. The hover/focus overlay is what says so — a
          bare avatar reads as decoration, and this one is the only way in. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={url ? "Ganti foto profil" : "Tambah foto profil"}
        title={url ? "Ganti foto profil" : "Tambah foto profil"}
        className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-subtle)] text-2xl font-semibold uppercase text-[var(--primary)] transition-transform duration-150 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98]"
      >
        {picture}
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <CameraIcon className="h-5 w-5" />
        </span>
      </button>

      {/* No `mounted` guard: the portal renders only once `open` is true, which
          only a click can do, so this is never reached during SSR. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Foto profil"
              className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Foto profil</h2>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    Muncul di sidebar panel dan di halaman ini.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Tutup"
                  className="-mr-1 -mt-1 rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

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
                    {picture}
                  </span>
                }
                onUpload={onUpload}
                onRemove={onRemove}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8.5A1.5 1.5 0 014.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0121 8.5v9A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5v-9z"
      />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
