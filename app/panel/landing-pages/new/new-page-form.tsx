"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLandingPage } from "@/lib/actions/landing-pages";
import { slugFromTitle, isValidSlug } from "@/lib/slug";

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Landing Page</title>
</head>
<body>
  <h1>Hello</h1>
  <p>Edit this HTML in the code editor.</p>
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
      setError("Please enter a title.");
      setLoading(false);
      return;
    }
    if (!isValidSlug(slug)) {
      setError("Slug must be lowercase letters, numbers, and hyphens only.");
      setLoading(false);
      return;
    }

    try {
      const id = await createLandingPage(title, slug, DEFAULT_HTML);
      router.push(`/panel/landing-pages/${id}/edit`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create page.");
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
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          placeholder="My landing page"
          required
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
          Used in /lp/[slug]. Lowercase letters, numbers, hyphens.
        </p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-foreground text-background rounded-md font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create and edit"}
      </button>
    </form>
  );
}
