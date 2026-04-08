"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteReceivedEmail } from "@/lib/actions/received-emails";

export function DeleteEmailButton({ emailId }: { emailId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteReceivedEmail(emailId);
    if (result.error) {
      alert(result.error);
      setDeleting(false);
      setConfirming(false);
      return;
    }
    router.push("/panel/inbox");
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-[var(--muted)]">Hapus?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          {deleting ? "Menghapus…" : "Ya, hapus"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs font-medium text-[var(--muted)] hover:text-foreground"
        >
          Batal
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      Hapus
    </button>
  );
}
