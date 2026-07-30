import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

/**
 * Editing chapter text inside an existing EPUB, in place.
 *
 * The deliberate choice here is that an edit rewrites the .epub ARCHIVE rather
 * than being stored as an overlay in Postgres. A book is two things at once —
 * the file a buyer downloads and the markup the web reader renders — and an
 * overlay would fix the typo in one while leaving it in the other. Rewriting the
 * archive keeps a single source of truth.
 *
 * Everything except the one chapter file is copied through byte-for-byte: the
 * OPF, the NCX/nav, stylesheets, fonts and every image. We are not re-authoring
 * the book, we are swapping the contents of one XHTML file's <body>.
 *
 * See lib/epub-server.ts for the read path used by the reader; the spine-walking
 * logic is deliberately the same shape so the chapter a seller edits is the
 * chapter a reader sees, at the same index.
 */

const dirOf = (p: string) => p.split("/").slice(0, -1).join("/");

function resolvePath(base: string, rel: string): string {
  let r = rel.split("#")[0];
  try {
    r = decodeURIComponent(r);
  } catch {
    /* keep as-is */
  }
  if (r.startsWith("/")) r = r.slice(1);
  const parts = base ? base.split("/") : [];
  for (const s of r.split("/")) {
    if (s === "..") parts.pop();
    else if (s === "." || s === "") continue;
    else parts.push(s);
  }
  return parts.join("/");
}

export type EpubChapterInfo = {
  /** Position in the spine — the same index the reader uses. */
  index: number;
  /** Path of the XHTML file inside the archive; the edit target's identity. */
  path: string;
  /** Best-effort display title. Falls back to the filename. */
  title: string;
  /** Visible characters, so a seller can spot a stub or a truncated chapter. */
  chars: number;
};

const stripTags = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

function bodyOf(xhtml: string): string {
  const m = xhtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1] : xhtml;
}

/** Text of the first element carrying the given class, if any. */
function byClass(xhtml: string, cls: string): string {
  const re = new RegExp(
    `<([a-z0-9]+)\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1>`,
    "i",
  );
  const m = xhtml.match(re);
  return m ? stripTags(m[2]) : "";
}

/**
 * A chapter's display name.
 *
 * Taking "the first heading" is wrong for these books: they open with TWO
 * headings, `<h1 class="chapter-num">BAB 1</h1>` followed by
 * `<h1 class="chapter-title">Langit yang Menahan Napas</h1>`, so the naive read
 * labelled every chapter "BAB 1", "BAB 2" … and the list was useless for finding
 * anything. The reader's own chapter list already prefers `.chapter-title`
 * (see components/reader-page-indicator.tsx); this matches it, and keeps the
 * number as a prefix so the two views agree.
 */
function titleOf(xhtml: string, path: string): string {
  const num = byClass(xhtml, "chapter-num");
  const named = byClass(xhtml, "chapter-title");
  if (named) return (num && num !== named ? `${num} · ${named}` : named).slice(0, 120);
  if (num) return num.slice(0, 120);

  const heading = xhtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
  const fromHeading = heading ? stripTags(heading) : "";
  if (fromHeading) return fromHeading.slice(0, 120);

  const docTitle = xhtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const fromTitle = docTitle ? stripTags(docTitle) : "";
  if (fromTitle) return fromTitle.slice(0, 120);

  return path.split("/").pop() || path;
}

type Opf = { files: Record<string, Uint8Array>; opfPath: string; opfDir: string; opf: string };

function openOpf(bytes: Uint8Array): Opf {
  const files = unzipSync(bytes);
  const container = strFromU8(files["META-INF/container.xml"] ?? new Uint8Array());
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath || !files[opfPath]) throw new Error("OPF not found");
  return { files, opfPath, opfDir: dirOf(opfPath), opf: strFromU8(files[opfPath]) };
}

function spinePaths({ files, opfDir, opf }: Opf): string[] {
  const manifest = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const tag = m[0];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) manifest.set(id, href);
  }
  const out: string[] = [];
  for (const m of opf.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/g)) {
    const href = manifest.get(m[1]);
    if (!href) continue;
    const path = resolvePath(opfDir, href);
    if (files[path]) out.push(path);
  }
  return out;
}

/** Spine-ordered chapters with a display title and a length, for the picker. */
export function listEpubChapters(bytes: Uint8Array): EpubChapterInfo[] {
  const o = openOpf(bytes);
  return spinePaths(o).map((path, index) => {
    const xhtml = strFromU8(o.files[path]);
    return { index, path, title: titleOf(xhtml, path), chars: stripTags(bodyOf(xhtml)).length };
  });
}

/**
 * The chapter's <body> markup, exactly as stored — image srcs are NOT rewritten
 * to /api/epub-asset here (unlike the reader path), because what the seller
 * edits has to be what goes back into the archive.
 */
export function readEpubChapter(bytes: Uint8Array, path: string): string | null {
  const { files } = openOpf(bytes);
  const raw = files[path];
  return raw ? bodyOf(strFromU8(raw)) : null;
}

/** Guard against an edit silently landing on a file that is not a chapter. */
export function isSpinePath(bytes: Uint8Array, path: string): boolean {
  return spinePaths(openOpf(bytes)).includes(path);
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
};

/** Images embedded per chapter are few (1–2), but a cover can still be large. */
const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;

export type ChapterAsset = { src: string; dataUri: string };

/**
 * The chapter's own stylesheets, concatenated.
 *
 * Without these the WYSIWYG editor is a lie: these books carry their typography
 * in classes — `chapter-num`, `first`, `dialog`, `center` — so a paragraph
 * stripped of its stylesheet looks identical to every other paragraph and a
 * seller can't see what they're editing.
 */
export function readChapterStyles(bytes: Uint8Array, chapterPath: string): string {
  const { files } = openOpf(bytes);
  const raw = files[chapterPath];
  if (!raw) return "";
  const xhtml = strFromU8(raw);
  const dir = dirOf(chapterPath);

  const out: string[] = [];
  for (const m of xhtml.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\bstylesheet\b/i.test(tag)) continue;
    const href = tag.match(/\bhref="([^"]+)"/i)?.[1];
    if (!href) continue;
    const css = files[resolvePath(dir, href)];
    if (css) out.push(strFromU8(css));
  }
  // Inline <style> blocks count too.
  for (const m of xhtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) out.push(m[1]);
  return out.join("\n");
}

/**
 * Images referenced by the chapter, as data URIs keyed by their ORIGINAL src.
 *
 * The editor renders in an iframe with no access to the archive, so relative
 * srcs would simply break. The client swaps these in for display and restores
 * the original src before saving, so what lands back in the EPUB still points at
 * the file inside it rather than a megabyte of base64.
 */
export function readChapterAssets(bytes: Uint8Array, chapterPath: string): ChapterAsset[] {
  const { files } = openOpf(bytes);
  const raw = files[chapterPath];
  if (!raw) return [];
  const body = bodyOf(strFromU8(raw));
  const dir = dirOf(chapterPath);

  const seen = new Set<string>();
  const out: ChapterAsset[] = [];
  for (const m of body.matchAll(
    /<(?:img|image)\b[^>]*?\b(?:src|href|xlink:href)="([^"]+)"/gi,
  )) {
    const src = m[1];
    if (!src || seen.has(src) || /^(data:|https?:|blob:)/i.test(src)) continue;
    seen.add(src);
    const data = files[resolvePath(dir, src)];
    if (!data || data.byteLength > MAX_INLINE_IMAGE_BYTES) continue;
    const ext = src.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    out.push({ src, dataUri: `data:${mime};base64,${Buffer.from(data).toString("base64")}` });
  }
  return out;
}

/**
 * Replace one chapter's <body> contents and return the rebuilt archive.
 *
 * `mimetype` is re-emitted first and STORED (level 0) as the EPUB spec requires
 * — fflate would otherwise deflate it in whatever order the object iterates, and
 * strict readers (and epubcheck) reject that.
 */
export function writeEpubChapter(
  bytes: Uint8Array,
  path: string,
  newBody: string,
): Uint8Array {
  const { files } = openOpf(bytes);
  const raw = files[path];
  if (!raw) throw new Error("Chapter not found in archive");

  const xhtml = strFromU8(raw);
  if (!/<body[^>]*>[\s\S]*?<\/body>/i.test(xhtml)) {
    throw new Error("Chapter has no <body> to replace");
  }
  // Replace only the body's contents, keeping the <body> tag's own attributes
  // (EPUBs routinely hang classes and epub:type off it).
  const updated = xhtml.replace(
    /(<body[^>]*>)([\s\S]*?)(<\/body>)/i,
    (_full, open: string, _inner: string, close: string) => `${open}${newBody}${close}`,
  );
  files[path] = strToU8(updated);

  const zippable: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  if (files["mimetype"]) zippable["mimetype"] = [files["mimetype"], { level: 0 }];
  for (const [p, data] of Object.entries(files)) {
    if (p === "mimetype") continue;
    zippable[p] = [data, { level: 6 }];
  }
  return zipSync(zippable);
}

/* -------------------------------------------------------------------------- */
/* Excerpt: a free preview cut from the deliverable                            */
/* -------------------------------------------------------------------------- */

export type EpubExcerptResult = {
  bytes: Uint8Array;
  /** Chapters kept vs the spine length of the source. */
  keptChapters: number;
  totalChapters: number;
  /** Prose characters kept vs total — the honest measure of "how much". */
  keptChars: number;
  totalChars: number;
  /** Titles of the kept spine entries, for the panel to show what the cut did. */
  keptTitles: string[];
  sourceBytes: number;
  excerptBytes: number;
};

/** Collect href/src targets a document points at, resolved against its own dir. */
function referencedPaths(text: string, baseDir: string): Set<string> {
  const out = new Set<string>();
  const add = (rel: string) => {
    const clean = rel.split("#")[0].trim();
    if (!clean || /^(https?:|data:|mailto:)/i.test(clean)) return;
    out.add(resolvePath(baseDir, clean));
  };
  for (const m of text.matchAll(/\b(?:href|src|xlink:href)="([^"]+)"/g)) add(m[1]);
  for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) add(m[1]);
  return out;
}

/**
 * Build a preview EPUB by keeping the FIRST `100 - cutPercent`% of the book.
 *
 * Cut by prose length, not by chapter count. Chapters are not equal — front
 * matter, a dedication and a 4000-word chapter are all one spine entry each, so
 * "keep 40% of the chapters" delivers wildly different amounts of actual reading
 * depending on where the short ones sit. Characters are what a reader spends.
 *
 * The cut still lands on a chapter boundary: a preview that stops mid-scene is
 * a bug report, not a cliffhanger. So chapters are accumulated in spine order
 * until the target is reached, and the chapter that crosses it is kept whole —
 * the excerpt is therefore never SHORTER than requested, only up to one chapter
 * longer.
 *
 * Everything the kept chapters need travels with them (styles, fonts, cover,
 * their own images). Images referenced only by dropped chapters are pruned —
 * this file is served to ad traffic on mobile, and shipping the back half's
 * artwork inside a preview is exactly the kind of dead weight that has cost this
 * project a campaign before.
 */
export function buildEpubExcerpt(bytes: Uint8Array, cutPercent: number): EpubExcerptResult {
  const cut = Math.min(95, Math.max(5, Math.round(cutPercent)));
  const keepRatio = (100 - cut) / 100;

  const o = openOpf(bytes);
  const spine = spinePaths(o);
  if (spine.length === 0) throw new Error("EPUB has no readable chapters");

  const lens = spine.map((p) => stripTags(bodyOf(strFromU8(o.files[p]))).length);
  const totalChars = lens.reduce((a, b) => a + b, 0);
  const target = totalChars * keepRatio;

  let acc = 0;
  let keep = 0;
  for (let i = 0; i < spine.length; i++) {
    keep = i + 1;
    acc += lens[i];
    if (acc >= target) break;
  }
  // Never emit the whole book as a "preview", and never emit nothing.
  keep = Math.max(1, Math.min(keep, spine.length - 1));
  acc = lens.slice(0, keep).reduce((a, b) => a + b, 0);

  const keptSpine = spine.slice(0, keep);
  const droppedSpine = new Set(spine.slice(keep));

  // What the survivors need. CSS/fonts are kept wholesale: they are small,
  // shared, and a missing stylesheet ruins the page the preview is judged on.
  const needed = new Set<string>(keptSpine);
  for (const p of keptSpine) {
    for (const r of referencedPaths(strFromU8(o.files[p]), dirOf(p))) needed.add(r);
  }
  for (const [p] of Object.entries(o.files)) {
    if (/\.(css|otf|ttf|woff2?|eot)$/i.test(p)) needed.add(p);
  }
  // Stylesheets pull in their own assets (background images, @font-face).
  for (const p of [...needed]) {
    if (!/\.css$/i.test(p) || !o.files[p]) continue;
    for (const r of referencedPaths(strFromU8(o.files[p]), dirOf(p))) needed.add(r);
  }
  // The cover is referenced from the OPF, not from any chapter.
  for (const m of o.opf.matchAll(/<item\b[^>]*>/g)) {
    const tag = m[0];
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (!href) continue;
    if (/properties="[^"]*cover-image/.test(tag) || /\bid="[^"]*cover/i.test(tag)) {
      needed.add(resolvePath(o.opfDir, href));
    }
  }

  const dropped = new Set<string>();
  for (const p of Object.keys(o.files)) {
    if (p === "mimetype" || p.startsWith("META-INF/") || p === o.opfPath) continue;
    if (/\.(ncx|opf)$/i.test(p) || /nav\.x?html?$/i.test(p)) continue;
    if (!needed.has(p)) dropped.add(p);
  }

  // Rewrite the OPF: a manifest entry pointing at a file we removed makes the
  // book invalid, and a spine itemref pointing at a removed id makes readers
  // show a blank page rather than stop.
  const idToPath = new Map<string, string>();
  let opf = o.opf.replace(/[ \t]*<item\b[^>]*\/?>(?:\s*<\/item>)?[ \t]*\n?/g, (tag) => {
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (!id || !href) return tag;
    const path = resolvePath(o.opfDir, href);
    idToPath.set(id, path);
    return dropped.has(path) ? "" : tag;
  });
  opf = opf.replace(/[ \t]*<itemref\b[^>]*\/?>(?:\s*<\/itemref>)?[ \t]*\n?/g, (tag) => {
    const idref = tag.match(/\bidref="([^"]+)"/)?.[1];
    const path = idref ? idToPath.get(idref) : undefined;
    return path && droppedSpine.has(path) ? "" : tag;
  });

  const files: Record<string, Uint8Array> = {};
  for (const [p, data] of Object.entries(o.files)) {
    if (dropped.has(p)) continue;
    files[p] = data;
  }
  files[o.opfPath] = strToU8(opf);

  // Prune the tables of contents so they don't advertise chapters that are gone.
  for (const p of Object.keys(files)) {
    if (/\.ncx$/i.test(p)) {
      const s = strFromU8(files[p]);
      files[p] = strToU8(
        s.replace(/[ \t]*<navPoint\b[\s\S]*?<\/navPoint>\s*/g, (block) => {
          const src = block.match(/\bsrc="([^"]+)"/)?.[1];
          if (!src) return block;
          return dropped.has(resolvePath(dirOf(p), src)) ? "" : block;
        }),
      );
    } else if (/nav\.x?html?$/i.test(p)) {
      const s = strFromU8(files[p]);
      files[p] = strToU8(
        s.replace(/[ \t]*<li\b[\s\S]*?<\/li>\s*/g, (block) => {
          const href = block.match(/\bhref="([^"]+)"/)?.[1];
          if (!href) return block;
          return dropped.has(resolvePath(dirOf(p), href)) ? "" : block;
        }),
      );
    }
  }

  // mimetype must be the first entry and STORED, or the file is not an EPUB.
  // Level 9 for the rest because this file is built once and served on every
  // preview; measured against fflate it is often byte-identical to level 6, so
  // treat it as "free if it helps", not as a size strategy.
  //
  // An excerpt is NOT guaranteed to be smaller than its source. On a short book
  // whose weight is cover art, fonts and CSS — all of which the excerpt still
  // needs — dropping half the chapters removes very little, and a source packed
  // by a stronger deflate than fflate's can come out slightly ahead. That is
  // expected: the excerpt exists to withhold the ending, not to save bytes.
  const zippable: Record<string, [Uint8Array, { level: 0 | 9 }]> = {};
  if (files["mimetype"]) zippable["mimetype"] = [files["mimetype"], { level: 0 }];
  for (const [p, data] of Object.entries(files)) {
    if (p === "mimetype") continue;
    zippable[p] = [data, { level: 9 }];
  }
  const out = zipSync(zippable);

  return {
    bytes: out,
    keptChapters: keep,
    totalChapters: spine.length,
    keptChars: acc,
    totalChars,
    keptTitles: keptSpine.map((p) => titleOf(strFromU8(o.files[p]), p)),
    sourceBytes: bytes.length,
    excerptBytes: out.length,
  };
}
