import { readableInk, type SiteAppearance } from "@/lib/site-appearance";

/**
 * Fetching a storefront's mark so it can be drawn INTO a generated PNG.
 *
 * `next/og` renders through satori → resvg, which draws an <img> by embedding
 * it in an SVG. That renderer can decode PNG, JPEG and SVG — and not WebP.
 * The icon upload accepts WebP (it is a fine favicon), so this returns null for
 * one rather than emitting an image with a hole in it, and the callers fall back
 * to the storefront's initials. A splash showing "BR" on the right background is
 * a worse logo but still the right storefront; a blank square is neither.
 */
const RENDERABLE = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

/** A mark is a mark. Anything past this is a mistake, and decoding it is cost. */
const MAX_BYTES = 512 * 1024;

export async function loadMark(url: string, origin: string): Promise<string | null> {
  const absolute = /^https?:\/\//i.test(url)
    ? url
    : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
  try {
    const res = await fetch(absolute, {
      // The icon behind this URL never changes — the upload path is timestamped,
      // so a new icon is a new URL. A day is only about surviving a redeploy.
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!RENDERABLE.has(type)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return null;
    return `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    // A storefront that boots without its logo is a cosmetic loss. Failing the
    // request instead would leave iOS with no launch image at all.
    return null;
  }
}

/**
 * The one element both generated-image routes draw: the mark if we could load
 * it, the storefront's initials if we could not.
 */
export function markElement(
  look: SiteAppearance,
  mark: string | null,
  boxPx: number,
  bg: string,
): React.ReactElement {
  if (mark) {
    return (
      // next/image is a browser component; this tree is rendered by satori into
      // a PNG on the server, where there is no <Image> and no optimiser.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mark}
        width={boxPx}
        height={boxPx}
        style={{ width: boxPx, height: boxPx, objectFit: "contain" }}
        alt=""
      />
    );
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: boxPx,
        height: boxPx,
        fontSize: Math.round(boxPx * 0.42),
        fontWeight: 700,
        letterSpacing: Math.round(boxPx * 0.02),
        color: readableInk(bg),
      }}
    >
      {look.initials}
    </div>
  );
}

/** A year at the CDN, keyed by the `?v=` fingerprint in the URL. */
export const IMAGE_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
};
