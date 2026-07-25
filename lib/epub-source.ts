import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";

/**
 * Resolve the EPUB that a product's public preview renders, or null when there
 * isn't one. Mirrors app/lp/[slug]/page.tsx exactly, so the epub-text/epub-asset
 * endpoints can never expose a file the preview page wouldn't already show.
 */
export async function resolvePreviewEpubUrl(slug: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: page } = await admin
    .from("lp_landing_pages")
    .select("preview_type, preview_url, story_epub_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!page) return null;

  if (page.preview_type === "epub") return page.preview_url?.trim() || null;
  if (page.preview_type === "deliverable" && page.story_epub_url) {
    return await getSignedDownloadUrl(page.story_epub_url);
  }
  return null;
}
