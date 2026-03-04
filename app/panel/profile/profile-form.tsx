"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions/profiles";

type Props = { initialFullName: string };

export function ProfileForm({ initialFullName }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const result = await updateProfile(formData);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    } else {
      setError(result.error ?? "Gagal menyimpan.");
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4 pt-4 border-t border-[var(--border)]">
      <h3 className="text-sm font-semibold text-foreground">Ubah nama tampilan</h3>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <label htmlFor="profile-full_name" className="sr-only">
          Nama lengkap
        </label>
        <input
          id="profile-full_name"
          type="text"
          name="full_name"
          defaultValue={initialFullName}
          placeholder="Nama Anda"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:opacity-95 active:scale-[0.98] transition-all"
        >
          Simpan
        </button>
      </div>
      {saved && <p className="text-sm text-green-600 dark:text-green-400">Tersimpan.</p>}
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
    </form>
  );
}
