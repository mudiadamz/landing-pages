"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLandingPage } from "@/lib/actions/landing-pages";
import { slugFromTitle, isValidSlug } from "@/lib/slug";

export function UploadForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const titleInput = form.querySelector('input[name="title"]') as HTMLInputElement;
    const slugInput = form.querySelector('input[name="slug"]') as HTMLInputElement;

    const file = fileInput?.files?.[0];
    const title = (titleInput?.value || "").trim();
    const slug = (slugInput?.value || "").trim().toLowerCase() || slugFromTitle(title);

    if (!file) {
      setError("Please select an HTML file.");
      setLoading(false);
      return;
    }
    if (!title) {
      setError("Please enter a title.");
      setLoading(false);
      return;
    }
    if (!isValidSlug(slug)) {
      setError("Slug must be lowercase letters, numbers, and hyphens only.");
      setLoading(false);
      return;
    }

    const htmlContent = await file.text();

    try {
      const id = await createLandingPage(title, slug, htmlContent);
      router.push(`/panel/landing-pages/${id}/edit`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create landing page.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-md">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="file" className="block text-sm font-medium mb-1">
          HTML file
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".html,text/html"
          required
          className="w-full px-3 py-2 border border-foreground/20 rounded-md bg-background text-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-foreground/10 file:text-foreground"
        />
      </div>
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          placeholder="My landing page"
          className="w-full px-3 py-2 border border-foreground/20 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30"
        />
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium mb-1">
          Slug (URL path)
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          placeholder="my-landing-page"
          className="w-full px-3 py-2 border border-foreground/20 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-foreground/60">
          Lowercase letters, numbers, hyphens. Used in /lp/[slug]
        </p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-foreground text-background rounded-md font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
