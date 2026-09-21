import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";

/**
 * Remove objects from the browser: `POST { bucket, paths }`. Runs as the
 * signed-in user, so only what the storage rules let them delete goes; the rest
 * is skipped silently, as Supabase's RLS-filtered delete did.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { bucket?: unknown; paths?: unknown } | null;
  const bucket = typeof body?.bucket === "string" ? body.bucket : "";
  const paths = Array.isArray(body?.paths) ? body.paths.filter((p): p is string => typeof p === "string") : [];
  if (!bucket || paths.length === 0) return NextResponse.json({ data: [] });

  const db = await createClient();
  const { data, error } = await db.storage.from(bucket).remove(paths);
  if (error) return NextResponse.json({ error }, { status: Number(error.statusCode) || 400 });
  return NextResponse.json({ data });
}
