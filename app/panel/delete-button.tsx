"use client";

import { deleteLandingPage } from "@/lib/actions/landing-pages";

export function DeleteButton({ id, size = "sm" }: { id: string; size?: "sm" | "lg" }) {
  async function handleDelete() {
    if (!confirm("Hapus produk ini?")) return;
    await deleteLandingPage(id);
  }

  const shape = size === "lg" ? "h-11 flex-1 border border-[var(--border)] active:scale-95" : "p-2 active:scale-90";

  return (
    <button
      type="button"
      onClick={handleDelete}
      title="Hapus"
      aria-label="Hapus"
      className={`inline-flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition ${shape}`}
    >
      <svg className={size === "lg" ? "w-5 h-5" : "w-4 h-4"} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}
