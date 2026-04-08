"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { hiringQuestions } from "@/lib/hiring-questions";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function HiringTestForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setFileName(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("Ukuran file melebihi 5 MB.");
      e.target.value = "";
      setFileName(null);
      return;
    }
    setFileName(file.name);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const formData = new FormData(formRef.current!);
      const res = await fetch("/api/hiring-test", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Terjadi kesalahan.");
        return;
      }

      router.push(data.redirectUrl);
    } catch {
      setError("Gagal mengirim. Coba lagi.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-8 space-y-5">
        <h2 className="text-base font-semibold text-foreground">Data diri</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
              Nama lengkap
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Nama kamu"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-foreground placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="email@contoh.com"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-foreground placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors"
            />
          </div>
        </div>

        <div>
          <label htmlFor="cv" className="block text-sm font-medium text-foreground mb-1.5">
            Upload CV <span className="text-[var(--muted)] font-normal">(PDF, maks 5 MB)</span>
          </label>
          <div className="relative">
            <input
              id="cv"
              name="cv"
              type="file"
              accept=".pdf"
              required
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]/40 transition-colors">
              <svg className="w-5 h-5 text-[var(--muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
              </svg>
              <span className="text-[var(--muted)] truncate">
                {fileName ?? "Pilih file CV (PDF)"}
              </span>
            </div>
          </div>
          {fileError && (
            <p className="mt-1.5 text-xs text-red-500">{fileError}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--accent-subtle)] px-4 py-3 flex items-start gap-3">
        <svg className="w-5 h-5 text-[var(--muted)] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
        </svg>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Tidak ada jawaban benar atau salah — dan tidak ada jawaban yang bisa di-Google atau GPT. Jawab sesuai dengan kepribadian dan cara kerjamu yang sesungguhnya.
        </p>
      </div>

      {hiringQuestions.map((q, qi) => (
        <div
          key={q.id}
          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-8 space-y-4"
        >
          <p className="text-sm font-medium text-foreground">
            <span className="text-[var(--muted)] mr-2">{qi + 1}.</span>
            {q.question}
          </p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <label
                key={oi}
                className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--accent-subtle)] cursor-pointer transition-colors has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary)]/5"
              >
                <input
                  type="radio"
                  name={`q${q.id}`}
                  value={oi}
                  required
                  className="mt-0.5 accent-[var(--primary)]"
                />
                <span className="text-sm text-[var(--muted)] leading-relaxed">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--accent-subtle)] px-4 py-3 flex items-start gap-3">
        <svg className="w-5 h-5 text-[var(--muted)] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
        </svg>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Review kembali jawabanmu sebelum mengirim. Pastikan jawaban benar-benar merefleksikan dirimu.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full px-5 py-3.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-95 active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Mengirim..." : "Kirim jawaban"}
      </button>
    </form>
  );
}
