"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions/profiles";
import { Button } from "@/components/ui/button";

type Props = { initialFullName: string };

export function ProfileForm({ initialFullName }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialFullName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value.trim() !== initialFullName.trim();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    setSaving(true);
    const result = await updateProfile(formData);
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    } else {
      setError(result.error ?? "Gagal menyimpan.");
    }
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <label htmlFor="profile-full_name" className="sr-only">
            Nama lengkap
          </label>
          <input
            id="profile-full_name"
            type="text"
            name="full_name"
            value={value}
            maxLength={100}
            // Controlled so the button can tell whether anything actually
            // changed — a Save that does nothing still looks like a failure.
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            placeholder="Nama Anda"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <Button type="submit" size="md" disabled={saving || !dirty} className="shrink-0">
          {saving ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
      {saved && <p className="text-sm text-green-600 dark:text-green-400">Tersimpan.</p>}
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
    </form>
  );
}
