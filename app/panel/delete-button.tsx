"use client";

import { deleteLandingPage } from "@/lib/actions/landing-pages";

export function DeleteButton({ id }: { id: string }) {
  async function handleDelete() {
    if (!confirm("Hapus landing page ini?")) return;
    await deleteLandingPage(id);
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-sm font-medium text-red-600 hover:underline"
    >
      Hapus
    </button>
  );
}
