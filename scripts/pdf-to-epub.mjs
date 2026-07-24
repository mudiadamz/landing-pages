#!/usr/bin/env node
/**
 * pdf-to-epub — convert a PDF into a clean, reflowable EPUB.
 *
 *   node scripts/pdf-to-epub.mjs <input.pdf> [output.epub] [--title "..."] [--author "..."]
 *
 * It extracts the text with pdf.js, rebuilds paragraphs (fixing line-break
 * hyphenation and dropping page numbers / running heads), splits into chapters
 * by heading font-size, and packages a spec-valid EPUB 3 with a nav + tidy CSS.
 * The reader themes light/dark and sizes the font itself, so the CSS stays
 * minimal and typographic.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { zipSync, strToU8 } from "fflate";

const require = createRequire(import.meta.url);

/* ----------------------------- args ------------------------------------- */

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i];
  else positional.push(argv[i]);
}
const [input, outputArg] = positional;
if (!input) {
  console.error('Usage: node scripts/pdf-to-epub.mjs <input.pdf> [output.epub] [--title "..."] [--author "..."]');
  process.exit(1);
}
const output = outputArg || input.replace(/\.pdf$/i, "") + ".epub";

/* ----------------------------- pdf.js ----------------------------------- */

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
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

const data = new Uint8Array(readFileSync(input));
const doc = await pdfjs.getDocument({
  data,
  useSystemFonts: true,
  standardFontDataUrl: STANDARD_FONTS,
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

/* ------------------------- text extraction ------------------------------ */
// Each "line" = { text, y, size }. y is the PDF baseline (larger = higher up).

/** @type {{page:number, lines:{text:string,y:number,size:number}[]}[]} */
const pages = [];
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
  pages.push({ page: p, lines });
  if (p % 25 === 0 || p === doc.numPages) process.stderr.write(`  …read ${p}/${doc.numPages} pages\r`);
}
process.stderr.write("\n");

/* --------------------------- analysis ----------------------------------- */

const allSizes = pages.flatMap((pg) => pg.lines.map((l) => Math.round(l.size)));
const bodySize = mode(allSizes) || 10;

// Drop likely page numbers / running heads: a lone short line that's just a
// number, or a very short line that repeats across many pages (header/footer).
const freq = new Map();
for (const pg of pages) for (const l of pg.lines) freq.set(l.text, (freq.get(l.text) ?? 0) + 1);
const repeated = new Set([...freq].filter(([, n]) => n >= Math.max(4, pages.length * 0.4)).map(([t]) => t));

const isJunk = (t) =>
  /^[\divxlcdm.\-—•\s]{1,6}$/i.test(t) || // page numbers / bullets
  repeated.has(t);

// Collapse letter-spaced labels ("B A B 1 0" -> "BAB 10") and tidy whitespace.
function normalizeHeading(t) {
  let s = t.trim();
  if (/^(?:\S ){2,}\S$/.test(s) && s.replace(/ /g, "").length <= 14) {
    s = s.replace(/ /g, "").replace(/([A-Za-z])(\d)/g, "$1 $2");
  }
  return s.replace(/\s+/g, " ").trim();
}

// A short label ("BAB 3", "Prolog") always counts; otherwise a heading must be a
// short, Title-cased, larger-font line that doesn't read like a sentence.
const isHeading = (l) => {
  const t = normalizeHeading(l.text);
  const labelLike = /^(bab|chapter|prolog|epilog)\b/i.test(t) && t.length <= 22;
  if (labelLike) return true;
  const startsUpper = /^[\p{Lu}\d]/u.test(t);
  return l.size >= bodySize * 1.3 && t.length <= 45 && startsUpper && !/[,;:]$/.test(t);
};

/* --------------------------- chapters ----------------------------------- */
// Walk lines in order, start a new chapter at each heading, and group the body
// lines into paragraphs by vertical gap (fixing hyphenation across breaks).

const flatLines = [];
for (const pg of pages) for (const l of pg.lines) if (!isJunk(l.text)) flatLines.push({ ...l, page: pg.page });

const chapters = [];
let cur = null;
const startChapter = (title, synthetic = false) => {
  cur = { title, paras: [], synthetic };
  chapters.push(cur);
};

let paraBuf = "";
let prevY = null;
let prevPage = null;

const pushPara = () => {
  const t = paraBuf.replace(/\s+/g, " ").trim();
  if (t && cur) cur.paras.push(t);
  paraBuf = "";
};

for (const l of flatLines) {
  if (isHeading(l)) {
    const t = normalizeHeading(l.text);
    // A number line ("BAB 1") immediately followed by a title line (no body
    // between) is one chapter — fold the second heading into the first's title.
    if (cur && cur.paras.length === 0 && !cur.synthetic) {
      cur.title = `${cur.title} — ${t}`;
    } else {
      pushPara();
      startChapter(t);
    }
    prevY = null;
    prevPage = l.page;
    continue;
  }
  if (!cur) startChapter(bookTitle, true); // front matter before the first heading

  // Paragraph break: big vertical gap on the same page (new page just continues).
  const gap = prevY !== null && prevPage === l.page ? prevY - l.y : 0;
  if (gap > bodySize * 1.6) pushPara();

  // Join, fixing hyphenated line-breaks: "kata-\n lanjut" -> "katalanjut".
  if (/[\p{L}]-$/u.test(paraBuf)) paraBuf = paraBuf.replace(/-\s*$/u, "") + l.text;
  else paraBuf = paraBuf ? `${paraBuf} ${l.text}` : l.text;

  prevY = l.y;
  prevPage = l.page;
}
pushPara();

// Drop chapters that ended up with no body (e.g. a stray heading, or an empty
// synthetic front-matter section).
for (let i = chapters.length - 1; i >= 0; i--) {
  if (chapters[i].paras.length === 0) chapters.splice(i, 1);
}

// If no headings were found, fall back to fixed-size chapters so the book is
// still navigable instead of one giant scroll.
if (chapters.length <= 1 && chapters[0]) {
  const paras = chapters[0].paras;
  const PER = 40; // paragraphs per chapter
  if (paras.length > PER * 1.5) {
    chapters.length = 0;
    for (let i = 0; i < paras.length; i += PER) {
      chapters.push({ title: `Bagian ${Math.floor(i / PER) + 1}`, paras: paras.slice(i, i + PER) });
    }
  }
}

const totalParas = chapters.reduce((n, c) => n + c.paras.length, 0);
if (totalParas === 0) {
  console.error("No extractable text found — this PDF may be scanned images (needs OCR).");
  process.exit(2);
}

/* ----------------------------- build EPUB -------------------------------- */

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const css = `body{margin:0;font-family:Georgia,'Times New Roman',serif;line-height:1.7;}
h1.chap{font-size:1.5em;font-weight:600;text-align:center;margin:1.6em 0 1em;line-height:1.3;}
p{margin:0;text-align:justify;text-indent:1.4em;hyphens:auto;}
p.first{text-indent:0;}
p.first::first-letter{font-size:1.05em;}`;

const chapterXhtml = (c) => {
  const body = c.paras
    .map((p, idx) => `<p class="${idx === 0 ? "first" : "body"}">${esc(p)}</p>`)
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

const id = (i) => `ch${String(i + 1).padStart(3, "0")}`;

const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:pdf2epub-${Buffer.from(bookTitle).toString("hex").slice(0, 24)}</dc:identifier>
    <dc:title>${esc(bookTitle)}</dc:title>
    ${bookAuthor ? `<dc:creator>${esc(bookAuthor)}</dc:creator>` : ""}
    <dc:language>id</dc:language>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${chapters.map((_, i) => `<item id="${id(i)}" href="${id(i)}.xhtml" media-type="application/xhtml+xml"/>`).join("\n    ")}
  </manifest>
  <spine>
    ${chapters.map((_, i) => `<itemref idref="${id(i)}"/>`).join("\n    ")}
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
  // mimetype MUST be first and stored (uncompressed) per the EPUB spec.
  mimetype: [strToU8("application/epub+zip"), { level: 0 }],
  "META-INF/container.xml": strToU8(container),
  "OEBPS/content.opf": strToU8(opf),
  "OEBPS/nav.xhtml": strToU8(nav),
  "OEBPS/style.css": strToU8(css),
};
chapters.forEach((c, i) => (files[`OEBPS/${id(i)}.xhtml`] = strToU8(chapterXhtml(c))));

writeFileSync(output, zipSync(files, { level: 6 }));

console.log(
  `✓ ${output}\n  “${bookTitle}”${bookAuthor ? ` — ${bookAuthor}` : ""}\n  ${chapters.length} chapter(s), ${totalParas} paragraph(s), from ${doc.numPages} page(s)`,
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
