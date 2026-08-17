"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLandingPage } from "@/lib/actions/landing-pages";
import { slugFromTitle, isValidSlug } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function UploadForm() {
  const t = useT();
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
      setError(t("panel.errSelectHtml"));
      setLoading(false);
      return;
    }
    if (!title) {
      setError(t("product.errTitleEmpty"));
      setLoading(false);
      return;
    }
    if (!isValidSlug(slug)) {
      setError(t("product.errSlugFormat"));
      setLoading(false);
      return;
    }

    const htmlContent = await file.text();

    try {
      const id = await createLandingPage(title, slug, htmlContent);
      router.push(`/panel/product/${id}/edit`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("panel.errCreatePageFailed"));
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
        <label htmlFor="file" className="block text-sm font-medium text-foreground mb-1.5">
          {t("panel.htmlFile")}
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".html,text/html"
          required
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-[var(--primary)] file:text-[var(--primary-foreground)] file:font-medium"
        />
      </div>
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1.5">
          {t("panel.title")}
        </label>
        <input
          id="title"
          name="title"
          type="text"
          placeholder={t("panel.productTitle")}
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
        />
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-foreground mb-1.5">
          {t("product.slugLabel")}
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          placeholder={t("product.slugPlaceholder")}
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground font-mono text-base sm:text-sm focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          {t("panel.slugHintUpload")}
        </p>
      </div>
      <Button
        type="submit"
        size="md"
        loading={loading}
        disabled={loading}
        className="py-3 shadow-sm"
      >
        {loading ? t("panel.uploading") : t("panel.upload")}
      </Button>
    </form>
  );
}
