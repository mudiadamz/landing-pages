"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyForBusiness } from "@/lib/actions/business-apply";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

export function ApplyBusinessForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<"individual" | "company">("individual");
  const [contactEmail, setContactEmail] = useState("");
  const [desiredHost, setDesiredHost] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await applyForBusiness({ name, businessType, contactEmail, desiredHost, note });
      if (!res.ok) {
        setError(res.error ?? "Gagal mengirim pengajuan.");
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-sm text-foreground">
        Pengajuan terkirim. Platform akan meninjau dan mengaktifkan business kamu.
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="text-xs font-medium text-foreground">Nama business</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          className={inputClass}
          placeholder="Toko Digital Saya"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-foreground">Tipe</span>
        <select
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value as "individual" | "company")}
          className={inputClass}
        >
          <option value="individual">Perorangan</option>
          <option value="company">Perusahaan</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-foreground">Email kontak</span>
        <span className="mt-0.5 block text-[0.6875rem] text-[var(--muted)]">
          Kosongkan untuk memakai email akun kamu.
        </span>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          maxLength={160}
          className={inputClass}
          placeholder="opsional"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-foreground">Domain yang diinginkan</span>
        <span className="mt-0.5 block text-[0.6875rem] text-[var(--muted)]">
          Opsional. Bisa ditambah nanti dari panel Domain.
        </span>
        <input
          type="text"
          value={desiredHost}
          onChange={(e) => setDesiredHost(e.target.value)}
          maxLength={160}
          className={inputClass}
          placeholder="tokosaya.com"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-foreground">Catatan untuk platform</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          className={inputClass}
          placeholder="Ceritakan singkat tentang bisnis kamu (opsional)."
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
      >
        {pending ? "Mengirim…" : "Kirim pengajuan"}
      </button>
    </form>
  );
}
