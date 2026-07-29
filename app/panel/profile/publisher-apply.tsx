"use client";

import { useState, useTransition } from "react";
import { applyAsPublisher } from "@/lib/actions/profiles";
import { LivePhotoCapture } from "@/components/live-photo-capture";
import type { PublisherStatus, Role } from "@/lib/profile-utils";

export function PublisherApply({
  role,
  status: initialStatus,
  rejectNote,
}: {
  role: Role;
  status: PublisherStatus;
  /** Why the last application was turned down, if it was. */
  rejectNote?: string | null;
}) {
  const [status, setStatus] = useState<PublisherStatus>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [ktp, setKtp] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);

  // Admins and existing publishers never see the apply CTA.
  if (role === "admin" || role === "publisher") {
    return (
      <p className="text-sm text-[var(--muted)]">
        {role === "admin"
          ? "Sebagai admin, Anda dapat mengelola & menjual produk."
          : "Anda adalah publisher — buka menu Produk digital untuk mulai menjual."}
      </p>
    );
  }

  function apply() {
    setError(null);
    startTransition(async () => {
      const res = await applyAsPublisher(ktp ?? undefined, selfie ?? undefined);
      if (res.ok) {
        setStatus("pending");
        setForm(false);
        // Don't keep ID photographs in memory once they've been handed over.
        setKtp(null);
        setSelfie(null);
      } else {
        setError(res.error ?? "Gagal mengirim pengajuan.");
      }
    });
  }

  return (
    <div>
      <p className="text-sm text-[var(--muted)]">
        Ingin menjual produk digital Anda sendiri di sini? Ajukan menjadi publisher.
        Setelah disetujui admin, Anda bisa membuat &amp; menjual produk.
      </p>

      {status === "pending" ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Pengajuan sedang ditinjau admin
        </p>
      ) : (
        <>
          {status === "rejected" && (
            <div className="mt-3 rounded-lg border border-red-300/60 bg-red-50 p-3 dark:border-red-800/50 dark:bg-red-900/15">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                Pengajuan sebelumnya ditolak.
              </p>
              {rejectNote && (
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  Catatan admin: {rejectNote}
                </p>
              )}
              <p className="mt-1 text-xs text-red-700/80 dark:text-red-300/80">
                Anda dapat mengajukan lagi dengan foto yang baru.
              </p>
            </div>
          )}

          {form ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-[var(--muted)]">
                Untuk verifikasi identitas, ambil dua foto{" "}
                <strong className="text-foreground">langsung dari kamera</strong> (tidak bisa
                pilih dari galeri). Foto hanya dilihat admin untuk verifikasi dan tidak
                ditampilkan di mana pun.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <LivePhotoCapture
                  label="Foto KTP"
                  hint="Pastikan seluruh kartu terlihat, teks terbaca, tidak silau."
                  facing="environment"
                  value={ktp}
                  onChange={setKtp}
                />
                <LivePhotoCapture
                  label="Foto selfie"
                  hint="Wajah terlihat jelas, sambil memegang KTP kalau bisa."
                  facing="user"
                  value={selfie}
                  onChange={setSelfie}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={apply}
                  disabled={pending || !ktp || !selfie}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Mengirim…" : "Kirim pengajuan"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(false);
                    setKtp(null);
                    setSelfie(null);
                    setError(null);
                  }}
                  disabled={pending}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Batal
                </button>
                {(!ktp || !selfie) && (
                  <span className="text-xs text-[var(--muted)]">
                    Kedua foto wajib diambil.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setForm(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {status === "rejected" ? "Ajukan lagi" : "Ajukan jadi publisher"}
            </button>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
