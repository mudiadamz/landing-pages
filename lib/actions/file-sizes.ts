"use server";

import { createAdminClient } from "@/lib/db/admin";
import { canSellProducts } from "@/lib/actions/profiles";

/**
 * Sizes for files that are already stored.
 *
 * The upload cards know a file's size only right after it's picked, from the
 * File object — so a product reopened later showed just a filename. This looks
 * the sizes up from storage so existing uploads read the same as fresh ones.
 *
 * Accepts either a public URL (thumbnails, previews) or a bare storage path
 * (the private deliverables), and returns a map keyed by whatever was passed in
 * so callers can look results up directly.
 */

const ASSETS = "landing-assets";
const DOWNLOADS = "landing-downloads";

/** Split a ref into its bucket + object path. */
function parseRef(ref: string): { bucket: string; path: string } | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  const publicMarker = "/storage/v1/object/public/";
  const i = trimmed.indexOf(publicMarker);
  if (i !== -1) {
    const rest = trimmed.slice(i + publicMarker.length).split("?")[0];
    const slash = rest.indexOf("/");
    if (slash === -1) return null;
    try {
      return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1)) };
    } catch {
      return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
    }
  }

  // An external URL has no size we can read from storage.
  if (/^https?:\/\//i.test(trimmed)) return null;

  // Otherwise it's a private deliverable path.
  return { bucket: DOWNLOADS, path: trimmed.replace(/^\/+/, "") };
}

export async function getStoredFileSizes(refs: string[]): Promise<Record<string, number>> {
  if (!(await canSellProducts())) return {};
  if (!refs?.length) return {};

  const admin = createAdminClient();
  const out: Record<string, number> = {};

  await Promise.all(
    [...new Set(refs.filter(Boolean))].slice(0, 40).map(async (ref) => {
      const parsed = parseRef(ref);
      if (!parsed) return;
      const { bucket, path } = parsed;
      const slash = path.lastIndexOf("/");
      const dir = slash === -1 ? "" : path.slice(0, slash);
      const name = slash === -1 ? path : path.slice(slash + 1);
      try {
        const { data } = await admin.storage
          .from(bucket === ASSETS || bucket === DOWNLOADS ? bucket : ASSETS)
          .list(dir, { search: name, limit: 100 });
        const hit = data?.find((f) => f.name === name);
        const size = (hit?.metadata as { size?: number } | undefined)?.size;
        if (typeof size === "number") out[ref] = size;
      } catch {
        /* best-effort — the card just falls back to showing no size */
      }
    }),
  );

  return out;
}
