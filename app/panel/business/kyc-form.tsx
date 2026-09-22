"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitBusinessKyc } from "@/lib/actions/business-money";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

export function KycForm({
  bankName: initName,
  bankAccount: initAccount,
  bankHolder: initHolder,
}: {
  bankName: string;
  bankAccount: string;
  bankHolder: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bankName, setBankName] = useState(initName);
  const [bankAccount, setBankAccount] = useState(initAccount);
  const [bankHolder, setBankHolder] = useState(initHolder);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await submitBusinessKyc({ bankName, bankAccount, bankHolder });
      if (!res.ok) {
        setError(res.error ?? "Gagal menyimpan.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="block">
        <span className="text-xs font-medium text-foreground">Nama bank</span>
        <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={80} className={inputClass} placeholder="BCA" />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-foreground">Nomor rekening</span>
        <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} maxLength={40} className={inputClass} placeholder="1234567890" />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-foreground">Atas nama</span>
        <input type="text" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} maxLength={120} className={inputClass} placeholder="Nama pemilik rekening" />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Tersimpan. KYC menunggu peninjauan platform.</p>}

      <button
        type="submit"
        disabled={pending || !bankName.trim() || !bankAccount.trim() || !bankHolder.trim()}
        className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "Simpan & ajukan KYC"}
      </button>
    </form>
  );
}
