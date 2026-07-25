import { NextResponse } from "next/server";
import { readEpubFile, IMG_MIME } from "@/lib/epub-server";
import { resolvePreviewEpubUrl } from "@/lib/epub-source";

/**
 * Serves a single image out of a product's preview EPUB, so chapter text can
 * render first and pictures stream in lazily afterwards. Downscales large
 * raster images when sharp is available (book covers are often multi-MB PNGs);
 * falls back to the original bytes if it isn't.
 */

export const revalidate = 86400;

const MAX_W = 1400;
const DOWNSCALE_OVER_BYTES = 300 * 1024;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const path = new URL(req.url).searchParams.get("p");
  if (!path) return NextResponse.json({ error: "Missing p" }, { status: 400 });

  try {
    const url = await resolvePreviewEpubUrl(slug);
    if (!url) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });

    const file = readEpubFile(new Uint8Array(await res.arrayBuffer()), path);
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    let out: Uint8Array = file;
    let type = IMG_MIME[ext] ?? "application/octet-stream";

    if (file.byteLength > DOWNSCALE_OVER_BYTES && ext !== "svg") {
      try {
        const sharp = (await import("sharp")).default;
        const buf = await sharp(Buffer.from(file))
          .rotate()
          .resize({ width: MAX_W, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        if (buf.byteLength < file.byteLength) {
          out = new Uint8Array(buf);
          type = "image/webp";
        }
      } catch {
        /* sharp unavailable — serve the original */
      }
    }

    return new NextResponse(Buffer.from(out) as unknown as BodyInit, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
