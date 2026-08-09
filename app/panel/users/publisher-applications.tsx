"use client";

import { useState, useTransition } from "react";
import { approvePublisher, rejectPublisher, type PublisherApplication } from "@/lib/actions/admin";

/**
 * Admin review queue for publisher applications.
 *
 * Both identity photos are shown inline — the whole point of collecting them is
 * that a person looks at them before approving, and a decision made from a name
 * and an email alone is what this replaced. The links are short-lived signed
 * URLs from a private bucket (see getPublisherApplications); they expire about
 * ten minutes after the page was rendered, so a tab left open shows broken
 * images rather than leaving someone's KTP reachable.
 *
 * Rejection requires a note, which the applicant sees on their profile. Turning
 * someone down without saying why just produces the same application again.
 */
export function PublisherApplications({ initial }: { initial: PublisherApplication[] }) {
  const [apps, setApps] = useState<PublisherApplication[]>(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [, startTransition] = useTransition();

  function approve(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const res = await approvePublisher(id);
      if (res.ok) setApps((prev) => prev.filter((a) => a.id !== id));
      else setError(res.error ?? "Gagal.");
      setPendingId(null);
    });
  }

  function confirmReject(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const res = await rejectPublisher(id, note);
      if (res.ok) {
        setApps((prev) => prev.filter((a) => a.id !== id));
        setRejecting(null);
        setNote("");
      } else {
        setError(res.error ?? "Gagal.");
      }
      setPendingId(null);
    });
  }

  if (apps.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 shadow-sm dark:border-amber-800/50 dark:bg-amber-900/15">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Pengajuan publisher</h2>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-800/50 dark:text-amber-200">
          {apps.length}
        </span>
      </div>

      <div className="space-y-2">
        {apps.map((a) => (
          <div key={a.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {/* The legal name leads, because approving means confirming it
                    matches the KTP photo below. The store name is what buyers
                    will see, so both are shown side by side. */}
                <p className="truncate font-medium text-foreground">
                  {a.real_name || a.full_name || "—"}
                </p>
                <p className="truncate text-sm text-[var(--muted)]">{a.email || "—"}</p>
                <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                  <Row label="Nama toko" value={a.display_name} />
                  <Row
                    label="Rekening"
                    value={
                      a.bank_name || a.bank_account
                        ? `${a.bank_name ?? "—"} · ${a.bank_account ?? "—"}`
                        : null
                    }
                  />
                  <Row label="Nama sesuai KTP" value={a.real_name} />
                  <Row label="Alamat" value={a.address} />
                  <Row label="Pemilik rekening" value={a.bank_holder} />
                </dl>
                <p className="mt-1.5 text-[11px]">
                  {a.terms_accepted_at ? (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Menyetujui ketentuan · {new Date(a.terms_accepted_at).toLocaleDateString("id-ID")}
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">
                      Pengajuan lama — sebelum ketentuan publisher ada
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => approve(a.id)}
                  disabled={pendingId === a.id}
                  className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {pendingId === a.id ? "…" : "Setujui"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejecting(rejecting === a.id ? null : a.id);
                    setNote("");
                  }}
                  disabled={pendingId === a.id}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-red-600 disabled:opacity-50"
                >
                  Tolak
                </button>
              </div>
            </div>

            {/* Identity photos — the reason this queue exists. */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <KycPhoto label="KTP" url={a.ktp_url} />
              <KycPhoto label="Selfie" url={a.selfie_url} />
            </div>

            {rejecting === a.id && (
              <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                <label
                  htmlFor={`note-${a.id}`}
                  className="block text-xs font-medium text-foreground"
                >
                  Alasan penolakan — ditampilkan ke pemohon
                </label>
                <textarea
                  id={`note-${a.id}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="mis. Foto KTP buram / nama tidak sesuai / selfie tidak jelas."
                  className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => confirmReject(a.id)}
                    disabled={pendingId === a.id || !note.trim()}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {pendingId === a.id ? "…" : "Tolak pengajuan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(null)}
                    disabled={pendingId === a.id}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    Batal
                  </button>
                  {!note.trim() && (
                    <span className="text-xs text-[var(--muted)]">Alasan wajib diisi.</span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Foto KTP &amp; selfie dihapus setelah pengajuan ditolak.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function KycPhoto({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-[var(--border)] px-3 text-center">
        <p className="text-xs text-[var(--muted)]">{label} tidak ada (pengajuan lama)</p>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Buka ${label} ukuran penuh`}
      className="block overflow-hidden rounded-lg border border-[var(--border)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="aspect-[4/3] w-full object-cover" />
      <span className="block bg-[var(--background)] px-2 py-1 text-xs text-[var(--muted)]">
        {label}
      </span>
    </a>
  );
}

/** One admin-only detail line. Renders an em dash rather than vanishing, so a
 *  missing field is visibly missing during review instead of merely absent. */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-[var(--muted)]">{label}:</dt>
      <dd className="min-w-0 truncate text-foreground" title={value ?? undefined}>
        {value || "—"}
      </dd>
    </div>
  );
}
