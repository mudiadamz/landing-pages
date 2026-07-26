import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findEpubCoverPath, readEpubFile } from "@/lib/epub-server";
import { resolvePreviewEpubUrl } from "@/lib/epub-source";

/**
 * The book's own cover art, pulled out of the EPUB and downscaled — used as the
 * splash while the reader loads, so visitors see the actual cover rather than a
 * wide listing banner.
 *
 * Falls back by redirecting to the product thumbnail when the archive has no
 * cover, so the splash <img> can point here unconditionally and never break.
 */

export const revalidate = 86400;

const MAX_W = 900;

async function thumbnailRedirect(slug: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_landing_pages")
    .select("thumbnail_url")
    .eq("slug", slug)
    .maybeSingle();
  const thumb = data?.thumbnail_url?.trim();
  if (!thumb) return NextResponse.json({ error: "No cover" }, { status: 404 });
  return NextResponse.redirect(thumb, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const url = await resolvePreviewEpubUrl(slug);
    if (!url) return thumbnailRedirect(slug);

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return thumbnailRedirect(slug);
    const bytes = new Uint8Array(await res.arrayBuffer());

    const coverPath = findEpubCoverPath(bytes);
    if (!coverPath) return thumbnailRedirect(slug);
    const file = readEpubFile(bytes, coverPath);
    if (!file) return thumbnailRedirect(slug);

    let out: Uint8Array = file;
    let type = "image/jpeg";
    try {
      const sharp = (await import("sharp")).default;
      const buf = await sharp(Buffer.from(file))
        .rotate()
        .resize({ width: MAX_W, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      out = new Uint8Array(buf);
      type = "image/webp";
    } catch {
      // sharp unavailable — serve the original bytes with a best-guess type.
      const ext = coverPath.split(".").pop()?.toLowerCase() ?? "";
      type =
        ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : ext === "svg"
              ? "image/svg+xml"
              : "image/jpeg";
    }

    return new NextResponse(Buffer.from(out) as unknown as BodyInit, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return thumbnailRedirect(slug);
  }
}
