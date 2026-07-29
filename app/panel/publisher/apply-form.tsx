"use client";

import { useState, useTransition } from "react";
import { applyAsPublisher } from "@/lib/actions/profiles";
import { LivePhotoCapture } from "@/components/live-photo-capture";
import type { PublisherStatus, Role } from "@/lib/profile-utils";

const EMPTY = {
  realName: "",
  displayName: "",
  bankName: "",
  bankHolder: "",
  bankAccount: "",
};

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {hint && <span className="mt-0.5 block text-[11px] text-[var(--muted)]">{hint}</span>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={120}
        className={`mt-1 ${inputClass}`}
      />
    </label>
  );
}

export function PublisherApplyForm({
  role,
  status: initialStatus,
  rejectNote,
  termsHeading,
  terms,
}: {
  role: Role;
  status: PublisherStatus;
  /** Why the last application was turned down, if it was. */
  rejectNote?: string | null;
  /** Publisher terms, configured in /panel/content. */
  termsHeading: string;
  terms: string[];
}) {
  const [status, setStatus] = useState<PublisherStatus>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [ktp, setKtp] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [fields, setFields] = useState(EMPTY);
  const [agreed, setAgreed] = useState(false);

  const set = (k: keyof typeof EMPTY) => (v: string) => setFields((p) => ({ ...p, [k]: v }));
  const filled =
    fields.realName.trim().length >= 3 &&
    fields.displayName.trim().length >= 3 &&
    fields.bankName.trim() !== "" &&
    fields.bankHolder.trim() !== "" &&
    fields.bankAccount.trim() !== "";
  const ready = !!ktp && !!selfie && filled && agreed;

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
      const res = await applyAsPublisher(ktp ?? undefined, selfie ?? undefined, {
        ...fields,
        acceptedTerms: agreed,
      });
      if (res.ok) {
        setStatus("pending");
        setForm(false);
        // Don't keep ID photographs or bank details in memory once handed over.
        setKtp(null);
        setSelfie(null);
        setFields(EMPTY);
        setAgreed(false);
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

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Nama lengkap sesuai KTP"
                  hint="Harus sama persis dengan KTP. Tidak ditampilkan ke pembeli."
                  value={fields.realName}
                  onChange={set("realName")}
                  placeholder="Nama seperti tertulis di KTP"
                />
                <Field
                  label="Nama toko (publisher)"
                  hint="Nama inilah yang dilihat pembeli. Boleh berbeda dari nama asli."
                  value={fields.displayName}
                  onChange={set("displayName")}
                  placeholder="Contoh: Studio Senja"
                />
              </div>

              <div className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs font-medium text-foreground">Rekening pencairan</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  Harus atas nama Anda sendiri. Hanya dilihat admin untuk pembayaran.
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <Field label="Nama bank" value={fields.bankName} onChange={set("bankName")} placeholder="BCA, Mandiri, …" />
                  <Field label="Nama pemilik" value={fields.bankHolder} onChange={set("bankHolder")} placeholder="Sesuai buku rekening" />
                  <Field label="Nomor rekening" value={fields.bankAccount} onChange={set("bankAccount")} placeholder="1234567890" />
                </div>
              </div>

              {terms.length > 0 && (
                <div className="rounded-lg border border-[var(--border)]">
                  <p className="border-b border-[var(--border)] px-3 py-2 text-xs font-medium text-foreground">
                    {termsHeading}
                  </p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto px-3 py-2 text-[11px] leading-relaxed text-[var(--muted)]">
                    {terms.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden>{i + 1}.</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="flex items-start gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                />
                <span>
                  Saya menyatakan nama di atas sama dengan KTP saya, dan saya menyetujui{" "}
                  <strong className="font-medium">{termsHeading.toLowerCase()}</strong>.
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={apply}
                  disabled={pending || !ready}
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
                    setFields(EMPTY);
                    setAgreed(false);
                    setError(null);
                  }}
                  disabled={pending}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Batal
                </button>
                {!ready && (
                  <span className="text-xs text-[var(--muted)]">
                    {!ktp || !selfie
                      ? "Kedua foto wajib diambil."
                      : !filled
                        ? "Lengkapi nama dan data rekening."
                        : "Centang persetujuan ketentuan publisher."}
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
