"use client";

import { useState, useTransition } from "react";
import {
  recordPayout,
  recordRefund,
  reviewBusinessKyc,
  sendPayout,
} from "@/lib/actions/business-money";

type Result = { ok: boolean; error?: string; note?: string };

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  function run(fn: () => Promise<Result>) {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Gagal.");
      else if (res.note) setNote(res.note);
    });
  }
  return { pending, error, note, run };
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const btnPrimary =
  "rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50";

export function KycControls({ id, status }: { id: string; status: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--muted)]">
        KYC: <span className="font-medium text-foreground">{status}</span>
      </span>
      {status !== "approved" && (
        <button type="button" disabled={pending} className={btnPrimary} onClick={() => run(() => reviewBusinessKyc(id, true))}>
          Setujui KYC
        </button>
      )}
      {status !== "rejected" && (
        <button type="button" disabled={pending} className={btnGhost} onClick={() => run(() => reviewBusinessKyc(id, false))}>
          Tolak
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

/**
 * One amount, two ways to spend it. "Kirim via Duitku" moves real money and is
 * shown only when the deployment has disbursement credentials AND the business
 * has a recognised bank code; "Catat manual" is always there, because a transfer
 * someone already made at the bank still has to be booked.
 *
 * The send button asks for confirmation: it is the only control in the panel
 * whose mistake cannot be undone from the panel.
 */
export function PayoutControl({
  id,
  available,
  canSend,
}: {
  id: string;
  available: number;
  canSend: boolean;
}) {
  const { pending, error, note, run } = useAction();
  const [amount, setAmount] = useState("");
  const value = Number(amount);

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => recordPayout(id, value));
      }}
    >
      <input
        type="number"
        min={0}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Jumlah payout"
        className={`${inputClass} max-w-[180px]`}
      />
      {canSend && (
        <button
          type="button"
          disabled={pending || !amount}
          className={btnPrimary}
          onClick={() => {
            if (!confirm(`Kirim Rp${value.toLocaleString("id-ID")} lewat Duitku? Transfer ini tidak bisa dibatalkan.`)) return;
            run(() => sendPayout(id, value));
          }}
        >
          Kirim via Duitku
        </button>
      )}
      <button type="submit" disabled={pending || !amount} className={canSend ? btnGhost : btnPrimary}>
        Catat manual
      </button>
      <span className="text-xs text-[var(--muted)]">tersedia: {available.toLocaleString("id-ID")}</span>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {note && <span className="text-xs text-amber-600">{note}</span>}
    </form>
  );
}

export function RefundControl({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => recordRefund(id, Number(amount), ref));
      }}
    >
      <input
        type="number"
        min={0}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Jumlah refund"
        className={`${inputClass} max-w-[160px]`}
      />
      <input
        type="text"
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="No. order"
        className={`${inputClass} max-w-[160px]`}
      />
      <button type="submit" disabled={pending || !amount || !ref} className={btnGhost}>
        Catat refund
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
