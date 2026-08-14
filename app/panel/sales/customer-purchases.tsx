"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  getCustomerPurchases,
  setPurchaseRevoked,
  type CustomerPurchase,
} from "@/lib/actions/purchase-access";
import { useT } from "@/lib/i18n/client";

/**
 * Per-customer access control, opened from the customer list.
 *
 * A popup rather than another table on the page: this is a rare, targeted action
 * — you already know which customer you came for — and the stats page is read at
 * a glance the rest of the time.
 */
export function CustomerPurchasesButton({
  userId,
  name,
  count,
}: {
  userId: string;
  name: string;
  count: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:text-foreground disabled:opacity-50"
        disabled={count === 0}
      >
        Kelola akses
      </button>
      {open && <Dialog userId={userId} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function Dialog({
  userId,
  name,
  onClose,
}: {
  userId: string;
  name: string;
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [rows, setRows] = useState<CustomerPurchase[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const revokedCount = rows?.filter((r) => r.revoked_at).length ?? 0;

  useEffect(() => {
    getCustomerPurchases(userId).then(setRows);
  }, [userId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function toggle(row: CustomerPurchase) {
    const revoking = !row.revoked_at;
    if (
      revoking &&
      !confirm(
        `Cabut akses "${row.title}" dari ${name}?\n\nMereka langsung tidak bisa membaca atau mengunduhnya. Datanya tetap tersimpan — bisa dipulihkan kapan saja.`,
      )
    ) {
      return;
    }
    const reason = revoking ? prompt("Alasan (opsional, hanya untuk catatan admin):") : undefined;

    setBusy(row.id);
    start(async () => {
      const res = await setPurchaseRevoked(row.id, revoking, reason ?? undefined);
      setBusy(null);
      if (!res.ok) {
        setMsg(res.error ?? "Gagal.");
        return;
      }
      setRows(
        (prev) =>
          prev?.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  revoked_at: revoking ? new Date().toISOString() : null,
                  revoke_reason: revoking ? reason?.trim() || null : null,
                }
              : r,
          ) ?? null,
      );
      setMsg(revoking ? `Akses "${row.title}" dicabut.` : `Akses "${row.title}" dipulihkan.`);
      // The customer list behind this dialog carries the revoked tally, so it has
      // to catch up now rather than on some later navigation.
      router.refresh();
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Akses pembelian ${name}`}
        className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">Akses pembelian</h2>
            <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
              {name}
              {rows && (
                <>
                  {" · "}
                  {rows.length} pembelian
                  {revokedCount > 0 && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {revokedCount} dicabut
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="-mr-1.5 -mt-1.5 rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <p className="mb-3 text-xs text-[var(--muted)]">
            Mencabut akses membuat produk langsung tidak bisa dibaca atau diunduh. Riwayat
            pembelian &amp; invoice tetap tersimpan — ini{" "}
            <strong className="text-foreground">bukan</strong> refund, dan angka penjualan
            tidak berubah.
          </p>

          {msg && <p className="mb-3 text-xs text-[var(--primary)]">{msg}</p>}

          {rows === null ? (
            <p className="text-sm text-[var(--muted)]">{t("common.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Belum ada pembelian.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        r.revoked_at ? "text-[var(--muted)] line-through" : "text-foreground"
                      }`}
                    >
                      {r.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {fmtDate(r.purchased_at)} · {r.amount > 0 ? fmtIDR(r.amount) : "Gratis"}
                      {r.bundle_parent_id && " · dari bundle"}
                      {r.invoice_number && ` · ${r.invoice_number}`}
                    </p>
                    {r.revoked_at && (
                      <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                        Dicabut {fmtDate(r.revoked_at)}
                        {r.revoke_reason && ` — ${r.revoke_reason}`}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(r)}
                    disabled={busy === r.id}
                    className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                      r.revoked_at
                        ? "border-[var(--border)] text-foreground hover:bg-[var(--background)]"
                        : "border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    }`}
                  >
                    {busy === r.id ? "…" : r.revoked_at ? "Pulihkan" : "Cabut akses"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
