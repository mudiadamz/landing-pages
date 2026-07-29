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

/** First heading, else <title>, else the filename. */
function titleOf(xhtml: string, path: string): string {
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
