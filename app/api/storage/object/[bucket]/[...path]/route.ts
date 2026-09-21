import { NextResponse } from "next/server";
import { BUCKETS } from "@/lib/backend/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * Upload from the browser: `PUT` the file's bytes as the body.
 *
 * Browser code (lib/upload-client.ts, the MbahGPT attachment picker) used to
 * write straight into Supabase Storage. Storage is the server's disk now, so
 * the bytes come here — as the SIGNED-IN USER, through the same storage client
 * server code uses, so exactly the same rules apply: own folder, sellers only
 * for the seller buckets, per-bucket size and type limits.
 *
 * The declared Content-Length is checked against the bucket's limit before the
 * body is read, so an oversized upload is refused without being buffered.
 */
type Ctx = { params: Promise<{ bucket: string; path: string[] }> };

export async function PUT(request: Request, { params }: Ctx) {
  const { bucket, path } = await params;
  const config = BUCKETS[bucket];
  if (!config) return NextResponse.json({ error: { message: "Bucket not found", statusCode: "404" } }, { status: 404 });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > config.fileSizeLimit) {
    return NextResponse.json(
      { error: { message: "The object exceeded the maximum allowed size", statusCode: "413" } },
      { status: 413 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).upload(path.join("/"), await request.arrayBuffer(), {
    contentType: request.headers.get("content-type") ?? undefined,
    upsert: request.headers.get("x-upsert") === "true",
  });
  if (error) return NextResponse.json({ error }, { status: Number(error.statusCode) || 400 });
  return NextResponse.json({ data });
}
