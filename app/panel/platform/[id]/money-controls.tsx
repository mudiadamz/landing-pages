"use client";

import { useState, useTransition } from "react";
import {
  recordPayout,
  recordRefund,
  reviewBusinessKyc,
} from "@/lib/actions/business-money";

type Result = { ok: boolean; error?: string };

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<Result>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Gagal.");
    });
  }
  return { pending, error, run };
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

export function PayoutControl({ id, available }: { id: string; available: number }) {
  const { pending, error, run } = useAction();
  const [amount, setAmount] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => recordPayout(id, Number(amount)));
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
      <button type="submit" disabled={pending || !amount} className={btnPrimary}>
        Catat payout
      </button>
      <span className="text-xs text-[var(--muted)]">tersedia: {available.toLocaleString("id-ID")}</span>
      {error && <span className="text-xs text-red-600">{error}</span>}
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
