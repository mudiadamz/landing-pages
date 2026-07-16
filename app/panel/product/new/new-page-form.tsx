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

  // Slug is generated automatically from the title. Once the user edits the
  // slug by hand, we stop overwriting it so their choice sticks.
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const effectiveSlug = slugEdited ? slug : slugFromTitle(title);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugEdited) setSlug(slugFromTitle(value));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const finalSlug = (effectiveSlug || "").trim().toLowerCase();

    if (!trimmedTitle) {
      setError("Judul tidak boleh kosong.");
      return;
    }
    if (!isValidSlug(finalSlug)) {
      setError("Slug hanya boleh huruf kecil, angka, dan tanda hubung.");
      return;
    }

    setLoading(true);
    try {
      const id = await createLandingPage(trimmedTitle, finalSlug, DEFAULT_HTML);
      router.push(`/panel/product/${id}/edit`);
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
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor="slug" className="block text-sm font-medium text-foreground">
            Slug (URL)
          </label>
          <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--primary)]">
            otomatis dari judul
          </span>
        </div>
        <input
          id="slug"
          name="slug"
          type="text"
          placeholder="judul-produk"
          value={effectiveSlug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(e.target.value.toLowerCase());
          }}
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground font-mono text-sm focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          Terisi sendiri dari judul — boleh diubah manual. Alamat produk:{" "}
          <span className="font-mono text-foreground">/lp/{effectiveSlug || "…"}</span>
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
