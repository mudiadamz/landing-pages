import { serveFile, verifyToken } from "@/lib/backend/storage";

/**
 * Private objects behind a signed URL — the replacement for Supabase's
 * createSignedUrl. The token is `exp.hmac(bucket/path:exp)` (lib/backend/storage),
 * so it names exactly one object and dies at `exp`; a changed character in
 * either the path or the token is a 403.
 *
 * Whoever holds the URL may fetch the file until it expires — that is what a
 * signed URL is for (a purchase download, a CV link in an admin e-mail). The
 * authorization happened when it was minted.
 */
type Ctx = { params: Promise<{ bucket: string; path: string[] }> };

async function handle(request: Request, { params }: Ctx): Promise<Response> {
  const { bucket, path } = await params;
  const name = path.join("/");
  const url = new URL(request.url);
  if (!verifyToken(bucket, name, url.searchParams.get("token"))) {
    return new Response("Invalid or expired signature", { status: 403 });
  }
  return serveFile(request, bucket, name, "private, max-age=0, no-store", url.searchParams.get("download"));
}

export const GET = handle;
export const HEAD = handle;
