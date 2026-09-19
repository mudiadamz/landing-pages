"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Force a product's preview to be served fresh.
 *
 * There is no API that empties the CDN here, and pretending otherwise is how
 * this project already lost a day: a Route Handler that sets its own
 * Cache-Control owns the edge entry, and `revalidatePath` does not touch it.
 * Measured at the time, back when a CDN still fronted this app — after an edit,
 * `?cb=<random>` returned new text while the plain URL returned old from an
 * upstream HIT (`age: 1058`).
 *
 * So this purges by rotating the key instead. Stamping `preview_purged_at`
 * feeds lib/epub-version.ts, every preview URL for the product becomes a URL
 * the CDN has never seen, and the old entries age out unattended.
 *
 * Normal edits do not need this — the version token already moves when the file
 * or the cut changes. It is for the cases the token cannot see: a file replaced
 * at the same path, a bad deploy cached mid-flight, or simply wanting certainty
 * before spending money pointing ads at the page.
 */
export async function purgePreviewCache(
  pageId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // RLS decides whether this user may touch the row; select the slug back so we
  // only revalidate paths that actually exist.
  const { data, error } = await supabase
    .from("lp_landing_pages")
    .update({ preview_purged_at: new Date().toISOString() })
    .eq("id", pageId)
    .select("slug")
    .single();

  if (error || !data) return { ok: false, error: "Gagal memuat ulang cache." };

  // The page itself is not edge-cached (private, no-store), but it holds the
  // token, so its render has to be redone for the new URLs to be handed out.
  revalidatePath(`/preview/${data.slug}`);
  revalidatePath(`/read/${data.slug}`);
  revalidatePath(`/panel/product/${pageId}/edit`);

  return { ok: true };
}
