import { BUCKETS, serveFile } from "@/lib/backend/storage";

/**
 * Public objects, at the same path Supabase served them from — so a stored URL
 * only needs its host changed, not its shape (docs/plans/remove-supabase.md,
 * fase 2). Only buckets marked public answer; the rest 404 here and are
 * reachable through signed URLs alone.
 *
 * In production Caddy can serve landing-assets straight from disk before a
 * request ever reaches Node; this route is the canonical behaviour (and what
 * development uses), so the two must send the same headers.
 */
type Ctx = { params: Promise<{ bucket: string; path: string[] }> };

async function handle(request: Request, { params }: Ctx): Promise<Response> {
  const { bucket, path } = await params;
  if (!BUCKETS[bucket]?.public) return new Response("Bucket not found", { status: 404 });
  return serveFile(request, bucket, path.join("/"), "public, max-age=3600");
}

export const GET = handle;
export const HEAD = handle;
