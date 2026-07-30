/**
 * Minimal WebP header reader — server-side only.
 *
 * Used to prove an upload really is WebP before it is stored. The declared MIME
 * type comes from the browser and a renamed PNG carries whatever the OS guessed,
 * so the container bytes are the only honest check. Reading the dimensions out
 * of the same header is free, and they let the popup reserve its space so it
 * cannot shift layout when it appears.
 *
 * Kept out of lib/popup-config.ts on purpose: that module is imported by client
 * components, and none of this belongs in the browser bundle.
 */

export const POPUP_MAX_BYTES = 300 * 1024;

export type WebpDimensions = { width: number; height: number };

export function readWebpHeader(buf: Buffer): WebpDimensions | null {
  // RIFF container: "RIFF" <u32 size> "WEBP" <chunk fourcc> ...
  if (buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buf.toString("ascii", 8, 12) !== "WEBP") return null;

  const chunk = buf.toString("ascii", 12, 16);

  // Lossy: 3-byte start code 0x9d012a, then 14-bit width and height.
  if (chunk === "VP8 ") {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }

  // Lossless: signature byte 0x2f, then 14 bits width-1 and 14 bits height-1
  // packed across four bytes.
  if (chunk === "VP8L") {
    if (buf[20] !== 0x2f) return null;
    const b = buf.readUInt32LE(21);
    return {
      width: (b & 0x3fff) + 1,
      height: ((b >> 14) & 0x3fff) + 1,
    };
  }

  // Extended (animation, alpha, metadata): canvas size as two 24-bit values.
  if (chunk === "VP8X") {
    const readU24 = (o: number) => buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
    return { width: readU24(24) + 1, height: readU24(27) + 1 };
  }

  return null;
}
