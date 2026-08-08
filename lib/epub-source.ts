import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";
import { clampCutPercent } from "@/lib/epub-cut";

export type PreviewEpubSource = {
  /**
   * Server-side URL of the archive to read. For an excerpt this points at the
   * COMPLETE book, so it must never be handed to the browser.
   */
  url: string;
  /** Percent of prose to withhold, or null when the whole file is public. */
  cutPercent: number | null;
};

/**
 * Resolve the EPUB that a product's public preview renders, and how much of it
 * may be shown. Mirrors app/preview/[slug]/page.tsx exactly, so the
 * epub-text/epub-asset endpoints can never expose a file the preview page
 * wouldn't already show.
 *
 * "excerpt" reads the DELIVERABLE — one file, no generated copy — and carries a
 * cut that the chapter endpoint has to apply before responding.
 */
export async function resolvePreviewEpubSource(slug: string): Promise<PreviewEpubSource | null> {
  const admin = createAdminClient();
  const { data: page } = await admin
    .from("lp_landing_pages")
    .select("preview_type, preview_url, story_epub_url, preview_cut_percent")
    .eq("slug", slug)
    .maybeSingle();
  if (!page) return null;

  if (page.preview_type === "epub") {
    const url = page.preview_url?.trim();
    return url ? { url, cutPercent: null } : null;
  }
  if (page.preview_type === "deliverable" && page.story_epub_url) {
    const url = await getSignedDownloadUrl(page.story_epub_url);
    return url ? { url, cutPercent: null } : null;
  }
  if (page.preview_type === "excerpt" && page.story_epub_url) {
    const url = await getSignedDownloadUrl(page.story_epub_url);
    return url ? { url, cutPercent: clampCutPercent(page.preview_cut_percent) } : null;
  }
  return null;
}

/** URL only — for the asset and cover routes, which serve no prose. */
export async function resolvePreviewEpubUrl(slug: string): Promise<string | null> {
  return (await resolvePreviewEpubSource(slug))?.url ?? null;
}
