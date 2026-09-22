import type { Site } from "@/lib/site-resolve";
import type { Locale } from "@/lib/i18n";

/**
 * A storefront's visual identity: its name, its wordmark, its square icon.
 *
 * Kept as a plain data shape with no server imports, because the header that
 * renders it is a client component — it cannot call currentSite() itself, so the
 * brand is resolved on the server and passed down as props.
 *
 * Two images, not one. They are different shapes with different jobs:
 *
 *   logoUrl  wide, sits in a ~28px-tall header slot beside the nav
 *   iconUrl  square, gets scaled to 16px in a browser tab and circle-masked on
 *            Android — a wordmark there is an unreadable smear
 *
 * Either may be null, and null is the common case: it means this storefront has
 * no art of its own and falls back to the Storefront defaults below.
 */
export type SiteBrand = {
  name: string;
  logoUrl: string | null;
  iconUrl: string | null;
  /**
   * The storefront's language, carried with its name and marks because it is
   * the same kind of fact and travels to the same places: shared chrome is a
   * client component that cannot resolve the site itself, so anything it needs
   * about the storefront has to arrive as a prop, and a second parallel prop
   * would be one more thing to forget on a new surface.
   */
  locale: Locale;
};

/** Shipped in public/. Also what an unconfigured deployment serves. */
export const DEFAULT_BRAND_NAME = "Storefront";
export const DEFAULT_ICON = "/icon.svg";
export const DEFAULT_ICON_192 = "/icon-192.png";
export const DEFAULT_ICON_512 = "/icon-512.png";
export const DEFAULT_APPLE_ICON = "/apple-touch-icon.png";

export function siteBrand(site: Site, locale: Locale = site.locale): SiteBrand {
  return {
    name: site.name?.trim() || DEFAULT_BRAND_NAME,
    logoUrl: site.logo_url?.trim() || null,
    iconUrl: site.icon_url?.trim() || null,
    locale,
  };
}

/**
 * "Bacaan Ringan" -> "BR". The avatar when a link-in-bio site has no icon, and the
 * only place a storefront's identity has to be synthesised rather than uploaded.
 */
export function brandInitials(name: string): string {
  return (
    (name || DEFAULT_BRAND_NAME)
      .split(/[\s.·—-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "A"
  );
}

/* ---------------------------------------------------------------------------
 * Upload validation. Pure, so it lives next to the type rather than inside the
 * server action, and can be unit-tested without a request.
 * ------------------------------------------------------------------------- */

/** Wordmarks and icons are small by nature; a megabyte here is a mistake, not a need. */
export const BRAND_LOGO_MAX_BYTES = 300 * 1024;
export const BRAND_ICON_MAX_BYTES = 200 * 1024;

export const BRAND_LOGO_ACCEPT = "image/png,image/webp,image/jpeg,image/svg+xml,.png,.webp,.jpg,.jpeg,.svg";
/**
 * No JPEG for the icon. It cannot carry transparency, so a JPEG favicon arrives
 * with a white box around it on every dark tab strip and every Android launcher.
 */
export const BRAND_ICON_ACCEPT = "image/png,image/webp,image/svg+xml,.png,.webp,.svg";

/**
 * A raster icon must be square and at least this wide.
 *
 * Not fussiness: the manifest declares the icon as `sizes: "any"`, which is only
 * true of something square, and Chrome needs 192px before it will treat a web app
 * as installable at all. Rejecting a 400x90 banner here is the difference between
 * the field existing and the field working.
 */
export const BRAND_ICON_MIN_PX = 192;
/** Small tolerance, so an export that is 512x513 isn't rejected for one pixel. */
export const BRAND_ICON_SQUARE_TOLERANCE = 0.02;

export type BrandImageKind = "logo" | "icon";

type Sniffed = { ext: string; contentType: string };

/**
 * What the bytes ACTUALLY are, not what the picker claimed.
 *
 * The declared MIME type is attacker-controlled in the general case and simply
 * wrong in the common one (browsers guess from the extension). Since the result
 * decides the Content-Type this file will later be served with from a public
 * bucket, it is sniffed from the magic bytes instead — a .svg that is really a
 * PNG, or an .png that is really an HTML document, both have to fail.
 */
export function sniffBrandImage(bytes: Uint8Array): Sniffed | null {
  const at = (i: number) => bytes[i];

  if (
    bytes.length > 8 &&
    at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 &&
    at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  if (bytes.length > 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  const ascii = (i: number, s: string) =>
    [...s].every((c, k) => bytes[i + k] === c.charCodeAt(0));
  if (bytes.length > 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) {
    return { ext: "webp", contentType: "image/webp" };
  }
  // SVG is text, so there is no signature to match — look for the root element in
  // the leading bytes, past any XML declaration, BOM or comment.
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 1024))
    .toLowerCase();
  if (head.includes("<svg")) {
    return { ext: "svg", contentType: "image/svg+xml" };
  }
  return null;
}

export function brandMaxBytes(kind: BrandImageKind): number {
  return kind === "icon" ? BRAND_ICON_MAX_BYTES : BRAND_LOGO_MAX_BYTES;
}

/**
 * PNG width/height, straight out of IHDR — 8-byte signature, 4-byte chunk length,
 * "IHDR", then two big-endian u32s. IHDR is mandated to be the first chunk, so no
 * scanning is needed.
 */
export function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const isIhdr = [..."IHDR"].every((c, i) => bytes[12 + i] === c.charCodeAt(0));
  if (!isIhdr) return null;
  const u32 = (o: number) =>
    ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  const width = u32(16);
  const height = u32(20);
  return width && height ? { width, height } : null;
}

/**
 * Is this shape usable as a square icon? Returns an Indonesian error, or null when
 * it's fine. SVG passes without measurement — it scales, which is the whole point.
 */
export function iconShapeError(dims: { width: number; height: number } | null): string | null {
  if (!dims) return "Tidak bisa membaca ukuran gambar. Coba PNG atau SVG.";
  const { width, height } = dims;
  const ratio = Math.abs(width - height) / Math.max(width, height);
  if (ratio > BRAND_ICON_SQUARE_TOLERANCE) {
    return `Ikon harus persegi (sekarang ${width}×${height}). Pakai logo lebar di kolom Logo.`;
  }
  if (Math.min(width, height) < BRAND_ICON_MIN_PX) {
    return `Ikon minimal ${BRAND_ICON_MIN_PX}×${BRAND_ICON_MIN_PX} px (sekarang ${width}×${height}).`;
  }
  return null;
}
