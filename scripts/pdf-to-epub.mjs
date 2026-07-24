#!/usr/bin/env node
/**
 * pdf-to-epub — convert a PDF into a clean, reflowable EPUB (with cover + images).
 *
 *   node scripts/pdf-to-epub.mjs <input.pdf> [output.epub] \
 *        [--title "..."] [--author "..."] [--cover-page N] [--no-cover] [--no-images]
 *
 * Text pages are reflowed into paragraphs and split into chapters by heading
 * font-size; the cover page and image-dominant (illustration) pages are rendered
 * to images so they survive in Apple Books / any reader. Packages a spec-valid
 * EPUB 3 with a cover-image, nav, and tidy typographic CSS.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { zipSync, strToU8 } from "fflate";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";

const require = createRequire(import.meta.url);

/* ----------------------------- args ------------------------------------- */

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--no-cover" || a === "--no-images") flags[a.slice(2)] = true;
  else if (a.startsWith("--")) flags[a.slice(2)] = argv[++i];
  else positional.push(a);
}
const [input, outputArg] = positional;
if (!input) {
  console.error(
    'Usage: node scripts/pdf-to-epub.mjs <input.pdf> [output.epub] [--title "..."] [--author "..."] [--cover-page N] [--no-cover] [--no-images]',
  );
  process.exit(1);
}
const output = outputArg || input.replace(/\.pdf$/i, "") + ".epub";
const coverPage = flags["cover-page"] ? Math.max(1, parseInt(flags["cover-page"], 10)) : 1;
const wantCover = !flags["no-cover"];
const wantImages = !flags["no-images"];

/* ----------------------------- pdf.js ----------------------------------- */

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { OPS } = pdfjs;
try {
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ).href;
} catch {
  /* fall back to the main-thread fake worker */
}
const STANDARD_FONTS = pathToFileURL(
  require.resolve("pdfjs-dist/package.json").replace(/package\.json$/, "standard_fonts/"),
).href;

// Minimal canvas factory so pdf.js can render pages in Node.
class NodeCanvasFactory {
  create(w, h) {
    const canvas = createCanvas(Math.ceil(w) || 1, Math.ceil(h) || 1);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(cc, w, h) {
    cc.canvas.width = Math.ceil(w) || 1;
    cc.canvas.height = Math.ceil(h) || 1;
  }
  destroy(cc) {
    cc.canvas.width = 0;
    cc.canvas.height = 0;
  }
}

const data = new Uint8Array(readFileSync(input));
const doc = await pdfjs.getDocument({
  data,
  useSystemFonts: true,
  standardFontDataUrl: STANDARD_FONTS,
  canvasFactory: new NodeCanvasFactory(),
  verbosity: 0,
}).promise;

const meta = await doc.getMetadata().catch(() => null);
const titleFromPdf = meta?.info?.Title?.trim();
const authorFromPdf = meta?.info?.Author?.trim();

const prettyName = basename(input)
  .replace(/\.pdf$/i, "")
  .replace(/[_-]+/g, " ")
  .replace(/\b(dark|light)\b/gi, "")
  .replace(/\s+/g, " ")
  .trim();

const bookTitle = flags.title || titleFromPdf || prettyName || "Untitled";
const bookAuthor = flags.author || authorFromPdf || "";

/* --------------------------- render helper ------------------------------ */

// Render a page to a resized JPEG buffer. `targetW` caps the pixel width.
async function renderPageJpeg(pageNum, targetW) {
  const page = await doc.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.5, Math.max(1, targetW / base.width));
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  // White backing so dark-mode PDFs don't render text on transparent/black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const png = await canvas.encode("png");
  return sharp(png).resize({ width: targetW, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
}

/* ------------------------- extract each page ---------------------------- */
// For every page: pull its text lines, and decide whether it's an illustration
// page (little text + an image) → render it whole instead of reflowing.

/** @type {({type:'text', page:number, lines:{text:string,y:number,size:number}[]} | {type:'figure', page:number, jpeg:Buffer})[]} */
const pageBlocks = [];
const images = {}; // filename -> Buffer
let coverJpeg = null;

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  const lines = [];
  let buf = "";
  let firstY = null;
  let maxSize = 0;
  const flush = () => {
    const text = buf.replace(/\s+/g, " ").trim();
    if (text) lines.push({ text, y: firstY ?? 0, size: maxSize || 10 });
    buf = "";
    firstY = null;
    maxSize = 0;
  };
  for (const it of content.items) {
    if (typeof it.str !== "string") continue;
    const size = it.height || Math.hypot(it.transform?.[2] ?? 0, it.transform?.[3] ?? 0) || 10;
    if (firstY === null) firstY = it.transform?.[5] ?? 0;
    maxSize = Math.max(maxSize, size);
    buf += it.str;
    if (it.hasEOL) flush();
  }
  flush();

  const textLen = lines.reduce((n, l) => n + l.text.length, 0);
  let hasImage = false;
  if (wantImages || (wantCover && p === coverPage)) {
    try {
      const ops = await page.getOperatorList();
      hasImage = ops.fnArray.some(
        (fn) => fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject,
      );
    } catch {
      /* ignore */
    }
  }

  // The cover page is rendered separately and excluded from the reading flow.
  if (wantCover && p === coverPage) {
    try {
      coverJpeg = await renderPageJpeg(p, 1000);
    } catch (e) {
      console.error(`  cover render failed: ${e.message}`);
    }
    process.stderr.write(`  …page ${p}/${doc.numPages} (cover)\r`);
    continue;
  }

  // Illustration page: little text + an image → keep it as a figure.
  if (wantImages && hasImage && textLen < 40) {
    try {
      const jpeg = await renderPageJpeg(p, 1200);
      const name = `img${String(p).padStart(3, "0")}.jpg`;
      images[name] = jpeg;
      pageBlocks.push({ type: "figure", page: p, jpeg: name });
      process.stderr.write(`  …page ${p}/${doc.numPages} (image)\r`);
      continue;
    } catch {
      /* fall through to text handling */
    }
  }

  pageBlocks.push({ type: "text", page: p, lines });
  if (p % 25 === 0 || p === doc.numPages) process.stderr.write(`  …page ${p}/${doc.numPages}\r`);
}
process.stderr.write("\n");

/* --------------------------- analysis ----------------------------------- */

const allSizes = pageBlocks.flatMap((b) => (b.type === "text" ? b.lines.map((l) => Math.round(l.size)) : []));
const bodySize = mode(allSizes) || 10;

const freq = new Map();
for (const b of pageBlocks) if (b.type === "text") for (const l of b.lines) freq.set(l.text, (freq.get(l.text) ?? 0) + 1);
const nTextPages = pageBlocks.filter((b) => b.type === "text").length;
const repeated = new Set([...freq].filter(([, n]) => n >= Math.max(4, nTextPages * 0.4)).map(([t]) => t));

const isJunk = (t) => /^[\divxlcdm.\-—•\s]{1,6}$/i.test(t) || repeated.has(t);

function normalizeHeading(t) {
  let s = t.trim();
  if (/^(?:\S ){2,}\S$/.test(s) && s.replace(/ /g, "").length <= 14) {
    s = s.replace(/ /g, "").replace(/([A-Za-z])(\d)/g, "$1 $2");
  }
  return s.replace(/\s+/g, " ").trim();
}

const isHeading = (l) => {
  const t = normalizeHeading(l.text);
  if (/^(bab|chapter|prolog|epilog)\b/i.test(t) && t.length <= 22) return true;
  const startsUpper = /^[\p{Lu}\d]/u.test(t);
  return l.size >= bodySize * 1.3 && t.length <= 45 && startsUpper && !/[,;:]$/.test(t);
};

/* --------------------------- chapters ----------------------------------- */
// Flatten pages into a stream of text lines + figures (in reading order), then
// build chapters: headings start chapters, gaps break paragraphs, figures drop
// in as image blocks.

const stream = [];
for (const b of pageBlocks) {
  if (b.type === "figure") stream.push({ kind: "figure", jpeg: b.jpeg, page: b.page });
  else for (const l of b.lines) if (!isJunk(l.text)) stream.push({ kind: "line", ...l, page: b.page });
}

const chapters = [];
let cur = null;
const startChapter = (title, synthetic = false) => {
  cur = { title, blocks: [], synthetic };
  chapters.push(cur);
};
let paraBuf = "";
let prevY = null;
let prevPage = null;
const pushPara = () => {
  const t = paraBuf.replace(/\s+/g, " ").trim();
  if (t && cur) cur.blocks.push({ type: "p", text: t });
  paraBuf = "";
};

for (const s of stream) {
  if (s.kind === "figure") {
    pushPara();
    if (!cur) startChapter(bookTitle, true);
    cur.blocks.push({ type: "img", src: s.jpeg });
    prevY = null;
    prevPage = s.page;
    continue;
  }
  const l = s;
  if (isHeading(l)) {
    const t = normalizeHeading(l.text);
    if (cur && cur.blocks.length === 0 && !cur.synthetic) cur.title = `${cur.title} — ${t}`;
    else {
      pushPara();
      startChapter(t);
    }
    prevY = null;
    prevPage = l.page;
    continue;
  }
  if (!cur) startChapter(bookTitle, true);
  const gap = prevY !== null && prevPage === l.page ? prevY - l.y : 0;
  if (gap > bodySize * 1.6) pushPara();
  if (/[\p{L}]-$/u.test(paraBuf)) paraBuf = paraBuf.replace(/-\s*$/u, "") + l.text;
  else paraBuf = paraBuf ? `${paraBuf} ${l.text}` : l.text;
  prevY = l.y;
  prevPage = l.page;
}
pushPara();

for (let i = chapters.length - 1; i >= 0; i--) if (chapters[i].blocks.length === 0) chapters.splice(i, 1);

if (chapters.length <= 1 && chapters[0]) {
  const blocks = chapters[0].blocks;
  const PER = 40;
  if (blocks.length > PER * 1.5) {
    chapters.length = 0;
    for (let i = 0; i < blocks.length; i += PER) {
      chapters.push({ title: `Bagian ${Math.floor(i / PER) + 1}`, blocks: blocks.slice(i, i + PER) });
    }
  }
}

const totalP = chapters.reduce((n, c) => n + c.blocks.filter((b) => b.type === "p").length, 0);
const totalImg = Object.keys(images).length + (coverJpeg ? 1 : 0);
if (totalP === 0 && totalImg === 0) {
  console.error("No extractable text or images found — this PDF may be scanned images (needs OCR).");
  process.exit(2);
}

/* ----------------------------- build EPUB -------------------------------- */

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const css = `body{margin:0;font-family:Georgia,'Times New Roman',serif;line-height:1.7;}
h1.chap{font-size:1.5em;font-weight:600;text-align:center;margin:1.6em 0 1em;line-height:1.3;}
p{margin:0;text-align:justify;text-indent:1.4em;hyphens:auto;}
p.first{text-indent:0;}
figure{margin:1em 0;text-align:center;}
img{max-width:100%;height:auto;display:block;margin:0 auto;}
.cover{margin:0;padding:0;}
.cover img{width:100%;height:auto;}`;

const id = (i) => `ch${String(i + 1).padStart(3, "0")}`;

const chapterXhtml = (c) => {
  let firstP = true;
  const body = c.blocks
    .map((b) => {
      if (b.type === "img") return `<figure><img src="${b.src}" alt=""/></figure>`;
      const cls = firstP ? "first" : "body";
      firstP = false;
      return `<p class="${cls}">${esc(b.text)}</p>`;
    })
    .join("\n  ");
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="id" lang="id">
<head>
  <meta charset="utf-8"/>
  <title>${esc(c.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1 class="chap">${esc(c.title)}</h1>
  ${body}
</body>
</html>`;
};

const coverXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="id" lang="id">
<head><meta charset="utf-8"/><title>Sampul</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body class="cover"><figure><img src="cover.jpg" alt="${esc(bookTitle)}"/></figure></body>
</html>`;

const manifest = [
  `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
  `<item id="css" href="style.css" media-type="text/css"/>`,
];
const spine = [];
if (coverJpeg) {
  manifest.push(`<item id="cover-img" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>`);
  manifest.push(`<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`);
  spine.push(`<itemref idref="cover" linear="yes"/>`);
}
for (const name of Object.keys(images)) {
  manifest.push(`<item id="${name.replace(/\W/g, "")}" href="${name}" media-type="image/jpeg"/>`);
}
chapters.forEach((_, i) => {
  manifest.push(`<item id="${id(i)}" href="${id(i)}.xhtml" media-type="application/xhtml+xml"/>`);
  spine.push(`<itemref idref="${id(i)}"/>`);
});

const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:pdf2epub-${Buffer.from(bookTitle).toString("hex").slice(0, 24)}</dc:identifier>
    <dc:title>${esc(bookTitle)}</dc:title>
    ${bookAuthor ? `<dc:creator>${esc(bookAuthor)}</dc:creator>` : ""}
    <dc:language>id</dc:language>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
    ${coverJpeg ? `<meta name="cover" content="cover-img"/>` : ""}
  </metadata>
  <manifest>
    ${manifest.join("\n    ")}
  </manifest>
  <spine>
    ${spine.join("\n    ")}
  </spine>
</package>`;

const nav = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="id" lang="id">
<head><meta charset="utf-8"/><title>Daftar Isi</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Daftar Isi</h1>
    <ol>
      ${chapters.map((c, i) => `<li><a href="${id(i)}.xhtml">${esc(c.title)}</a></li>`).join("\n      ")}
    </ol>
  </nav>
</body>
</html>`;

const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const files = {
  mimetype: [strToU8("application/epub+zip"), { level: 0 }],
  "META-INF/container.xml": strToU8(container),
  "OEBPS/content.opf": strToU8(opf),
  "OEBPS/nav.xhtml": strToU8(nav),
  "OEBPS/style.css": strToU8(css),
};
if (coverJpeg) {
  files["OEBPS/cover.jpg"] = new Uint8Array(coverJpeg);
  files["OEBPS/cover.xhtml"] = strToU8(coverXhtml);
}
for (const [name, buf] of Object.entries(images)) files[`OEBPS/${name}`] = new Uint8Array(buf);
chapters.forEach((c, i) => (files[`OEBPS/${id(i)}.xhtml`] = strToU8(chapterXhtml(c))));

writeFileSync(output, zipSync(files, { level: 6 }));

console.log(
  `✓ ${output}\n  “${bookTitle}”${bookAuthor ? ` — ${bookAuthor}` : "  (no author — pass --author \"Name\")"}\n  ${chapters.length} chapter(s), ${totalP} paragraph(s), ${totalImg} image(s)${coverJpeg ? " incl. cover" : ""}, from ${doc.numPages} page(s)`,
);

/* ----------------------------- helpers ---------------------------------- */

function mode(arr) {
  const m = new Map();
  let best = null;
  let bestN = 0;
  for (const v of arr) {
    const n = (m.get(v) ?? 0) + 1;
    m.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}
