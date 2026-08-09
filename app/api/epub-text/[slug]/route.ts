import { NextResponse } from "next/server";
import { neutralizeDeadFragments, extractEpubChapters } from "@/lib/epub-server";
import { resolvePreviewEpubSource } from "@/lib/epub-source";
import { keepCountForCut, visibleChars } from "@/lib/epub-cut";

/**
 * Chapter markup for a product's EPUB preview, unzipped server-side. The client
 * fetches this (tens of KB) instead of the whole archive (often several MB of
 * images), so text paints almost immediately on mobile data.
 *
 * Only serves what the preview page already shows publicly: an "epub" preview,
 * a "deliverable" preview whose EPUB is intentionally readable for free, or an
 * "excerpt" — the deliverable truncated to its first N% of prose.
 *
 * The excerpt cut is applied HERE, on the server, and the withheld chapters are
 * never put in the response. There is only one file, so the alternative would be
 * shipping the whole book to the browser and asking the reader not to scroll.
 */

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const source = await resolvePreviewEpubSource(slug);
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { url, cutPercent } = source;

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
    const bytes = new Uint8Array(await res.arrayBuffer());

    const { chapters: allChapters } = extractEpubChapters(
      bytes,
      (path) => `/api/epub-asset/${encodeURIComponent(slug)}?p=${encodeURIComponent(path)}`,
      // Start the preview on the writing, not a second copy of the cover.
      { dropLeadingImageOnly: true },
    );

    // Truncate before serialising: `chapters` is what leaves the building.
    const lens = allChapters.map(visibleChars);
    const keep = cutPercent === null ? allChapters.length : keepCountForCut(lens, cutPercent);
    // After the cut, so links to withheld chapters stop being live.
    const chapters = neutralizeDeadFragments(allChapters.slice(0, keep));

    // Counts, not content: how much is being held back is the one thing the
    // gate at the end of the preview has to be able to say precisely.
    const excerpt =
      keep < allChapters.length
        ? {
            shownChapters: keep,
            totalChapters: allChapters.length,
            shownChars: lens.slice(0, keep).reduce((a, b) => a + b, 0),
            totalChars: lens.reduce((a, b) => a + b, 0),
          }
        : null;

    return NextResponse.json(
      { chapters, excerpt },
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
