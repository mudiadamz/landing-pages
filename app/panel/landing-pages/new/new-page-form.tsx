"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLandingPage } from "@/lib/actions/landing-pages";
import { slugFromTitle, isValidSlug } from "@/lib/slug";
import { Button } from "@/components/ui/button";

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Landing Page</title>
</head>
<body>
  <h1>Halo</h1>
  <p>Edit HTML ini di code editor.</p>
</body>
</html>`;

export function NewPageForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const titleInput = form.querySelector('input[name="title"]') as HTMLInputElement;
    const slugInput = form.querySelector('input[name="slug"]') as HTMLInputElement;

    const title = (titleInput?.value || "").trim();
    const slug = (slugInput?.value || "").trim().toLowerCase() || slugFromTitle(title);

    if (!title) {
      setError("Judul tidak boleh kosong.");
      setLoading(false);
      return;
    }
    if (!isValidSlug(slug)) {
      setError("Slug hanya boleh huruf kecil, angka, dan tanda hubung.");
      setLoading(false);
      return;
    }

    try {
      const id = await createLandingPage(title, slug, DEFAULT_HTML);
      router.push(`/panel/landing-pages/${id}/edit`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat produk.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1.5">
          Judul (Title)
        </label>
        <input
          id="title"
          name="title"
          type="text"
          placeholder="Judul produk"
          required
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
        />
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-foreground mb-1.5">
          Slug (URL)
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          placeholder="judul-produk"
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground font-mono text-sm focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          Dipakai di /lp/[slug]. Huruf kecil, angka, dan tanda hubung. Kosongkan untuk otomatis dari
          judul.
        </p>
      </div>
      <Button
        type="submit"
        size="md"
        loading={loading}
        disabled={loading}
        className="py-3 shadow-sm"
        rightIcon={
          !loading ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          ) : undefined
        }
      >
        {loading ? "Membuat…" : "Buat & lanjut ke langkah 2"}
      </Button>
    </form>
  );
}
