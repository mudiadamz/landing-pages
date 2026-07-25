import { NextResponse } from "next/server";
import { extractEpubChapters } from "@/lib/epub-server";
import { resolvePreviewEpubUrl } from "@/lib/epub-source";

/**
 * Chapter markup for a product's EPUB preview, unzipped server-side. The client
 * fetches this (tens of KB) instead of the whole archive (often several MB of
 * images), so text paints almost immediately on mobile data.
 *
 * Only serves what the preview page already shows publicly: an "epub" preview,
 * or a "deliverable" preview whose EPUB is intentionally readable for free.
 */

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const url = await resolvePreviewEpubUrl(slug);
    if (!url) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
    const bytes = new Uint8Array(await res.arrayBuffer());

    const { chapters } = extractEpubChapters(
      bytes,
      (path) => `/api/epub-asset/${encodeURIComponent(slug)}?p=${encodeURIComponent(path)}`,
    );

    return NextResponse.json(
      { chapters },
      {
        headers: {
          // Cached at the edge so only the first reader pays the unzip cost.
          "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Unreadable EPUB" }, { status: 500 });
  }
}
