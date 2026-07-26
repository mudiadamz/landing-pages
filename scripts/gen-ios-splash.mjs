/**
 * Generates the iOS launch images in public/splash.
 *
 * Run after changing the logo or the target list:
 *   node scripts/gen-ios-splash.mjs
 *
 * Each image is the app background with the logo centred at a size that reads
 * well on both phones and iPads — deliberately plain, so it blends into the
 * real page as it loads instead of flashing a different design.
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(root, "public", "splash");
const LOGO = path.join(root, "public", "icon-512.png");

// Kept in sync with lib/ios-splash.ts (plain data, duplicated so this script
// can run without a TypeScript loader).
const TARGETS = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3],
  [414, 896, 2], [414, 896, 3], [390, 844, 3], [393, 852, 3],
  [402, 874, 3], [428, 926, 3], [430, 932, 3], [440, 956, 3],
  [768, 1024, 2], [810, 1080, 2], [834, 1112, 2], [834, 1194, 2], [1024, 1366, 2],
];

const BG = { light: "#fdfcfb", dark: "#0d0d0f" };

await mkdir(OUT, { recursive: true });

let count = 0;
for (const [cw, ch, ratio] of TARGETS) {
  const w = cw * ratio;
  const h = ch * ratio;
  // Logo occupies a comfortable share of the shorter edge.
  const logoSize = Math.round(Math.min(w, h) * 0.34);
  const logo = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  for (const scheme of ["light", "dark"]) {
    const png = await sharp({
      create: { width: w, height: h, channels: 4, background: BG[scheme] },
    })
      .composite([{ input: logo, gravity: "center" }])
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();

    const name = `apple-splash-${w}-${h}${scheme === "dark" ? "-dark" : ""}.png`;
    await writeFile(path.join(OUT, name), png);
    count++;
  }
}

console.log(`generated ${count} splash images in public/splash`);
