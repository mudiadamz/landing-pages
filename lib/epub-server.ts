import { unzipSync, strFromU8 } from "fflate";

/**
 * Server-side EPUB unpacking. The client used to download the whole .epub and
 * unzip it in the browser before a single word appeared — on a typical book the
 * text is only ~2% of the archive (images are the rest), so that cost seconds of
 * blank screen on mobile data. Here we unzip once on the server and hand the
 * client just the chapter markup, with image srcs pointed at /api/epub-asset.
 *
 * The markup returned is still RAW (unsanitized) — the client sanitizes it with
 * DOMParser exactly as before, so the security model is unchanged.
 */

export const IMG_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
};

const dirOf = (p: string) => p.split("/").slice(0, -1).join("/");

export function resolveEpubPath(base: string, rel: string): string {
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

/** Extract one file from the archive (used by the image endpoint). */
export function readEpubFile(bytes: Uint8Array, path: string): Uint8Array | null {
  const files = unzipSync(bytes);
  return files[path] ?? null;
}

/**
 * Locate the book's cover image inside the archive. Checks the three ways EPUBs
 * declare one, in order of reliability: the OPF `<meta name="cover">` pointer,
 * a manifest item marked `properties="cover-image"`, then a filename that looks
 * like a cover. Returns null when the book doesn't ship one.
 */
export function findEpubCoverPath(bytes: Uint8Array): string | null {
  const files = unzipSync(bytes);
  const container = strFromU8(files["META-INF/container.xml"] ?? new Uint8Array());
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath || !files[opfPath]) return null;
  const opfDir = dirOf(opfPath);
  const opf = strFromU8(files[opfPath]);

  const items = [...opf.matchAll(/<item\b[^>]*>/g)].map((m) => m[0]);
  const attr = (tag: string, name: string) =>
    tag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1] ?? null;

  const isImage = (href: string) => /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(href);
  const exists = (href: string) => {
    const p = resolveEpubPath(opfDir, href);
    return files[p] ? p : null;
  };

  // 1) <meta name="cover" content="itemId"/>
  const metaId = opf.match(/<meta\b[^>]*\bname="cover"[^>]*\bcontent="([^"]+)"/i)?.[1];
  if (metaId) {
    for (const tag of items) {
      if (attr(tag, "id") === metaId) {
        const href = attr(tag, "href");
        if (href) {
          const p = exists(href);
          if (p) return p;
        }
      }
    }
  }

  // 2) properties="cover-image"
  for (const tag of items) {
    if (attr(tag, "properties")?.includes("cover-image")) {
      const href = attr(tag, "href");
      if (href) {
        const p = exists(href);
        if (p) return p;
      }
    }
  }

  // 3) an image whose id/href mentions "cover"
  for (const tag of items) {
    const href = attr(tag, "href");
    const id = attr(tag, "id") ?? "";
    if (href && isImage(href) && (/cover/i.test(href) || /cover/i.test(id))) {
      const p = exists(href);
      if (p) return p;
    }
  }

  return null;
}

/** What a book can tell us about itself, for the one-step product form. */
export type EpubMeta = {
  title: string;
  description: string;
  /** Path inside the archive, or null when the book ships no cover. */
  coverPath: string | null;
};

const stripTags = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Title, description and cover, read out of the book itself.
 *
 * The OPF is the authority for title and description — it is what the author
 * filled in. `dc:description` is often missing though, so the opening prose is
 * the fallback: a blurb taken from the book's own first words is closer to the
 * truth than an empty field, and the seller can rewrite it in the full form.
 */
export function extractEpubMeta(bytes: Uint8Array): EpubMeta {
  const files = unzipSync(bytes);
  const container = strFromU8(files["META-INF/container.xml"] ?? new Uint8Array());
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1];
  const opf = opfPath && files[opfPath] ? strFromU8(files[opfPath]) : "";

  const tag = (name: string) => {
    const m = opf.match(new RegExp(`<dc:${name}[^>]*>([\\s\\S]*?)</dc:${name}>`, "i"));
    return m ? stripTags(m[1]) : "";
  };

  let description = tag("description");
  if (!description) {
    // First readable prose in the spine. dropLeadingImageOnly skips the cover
    // page, which otherwise contributes an empty string here.
    try {
      const { chapters } = extractEpubChapters(bytes, () => "", { dropLeadingImageOnly: true });
      for (const c of chapters) {
        const text = stripTags(c);
        if (text.length > 80) {
          description = text.slice(0, 320).trim();
          // End on a sentence rather than mid-word.
          const cut = description.lastIndexOf(". ");
          if (cut > 120) description = description.slice(0, cut + 1);
          break;
        }
      }
    } catch {
      /* a book we cannot read simply has no blurb */
    }
  }

  return {
    title: tag("title"),
    description,
    coverPath: findEpubCoverPath(bytes),
  };
}

export type EpubChapters = { chapters: string[] };

/**
 * Strip hrefs that point at anchors no longer on the page.
 *
 * Run AFTER any truncation, not before: an excerpt cuts the last chapters, and
 * the book's table of contents still lists them. Rewritten links to those
 * chapters are not 404s any more, but they are taps that do nothing, which is
 * its own kind of broken. The text stays and only the href goes, so the reader
 * sees the chapter exists — which is the honest state for a paywalled book.
 */
export function neutralizeDeadFragments(chapters: string[]): string[] {
  const present = new Set<string>();
  for (const html of chapters) {
    for (const m of html.matchAll(/\bid=["']([^"']+)["']/g)) present.add(m[1]);
  }
  return chapters.map((html) =>
    html.replace(/(<a\b[^>]*?\bhref=)(["'])#(.*?)\2/gi, (full, _p: string, _q: string, frag: string) =>
      present.has(frag) ? full : full.replace(/\bhref=(["'])#.*?\1/i, 'data-epub-dead="1"'),
    ),
  );
}

/**
 * Ordered spine chapters as raw HTML body markup. `assetUrl(path)` maps an
 * in-archive image path to a URL the browser can fetch lazily.
 */
export function extractEpubChapters(
  bytes: Uint8Array,
  assetUrl: (path: string) => string,
  opts: { dropLeadingImageOnly?: boolean } = {},
): EpubChapters {
  const files = unzipSync(bytes);

  const container = strFromU8(files["META-INF/container.xml"] ?? new Uint8Array());
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath || !files[opfPath]) throw new Error("OPF not found");
  const opfDir = dirOf(opfPath);
  const opf = strFromU8(files[opfPath]);

  const manifest = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const tag = m[0];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) manifest.set(id, href);
  }
  const spine = [...opf.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/g)].map((m) => m[1]);

  /**
   * A stable in-page anchor id for a chapter file.
   *
   * Derived from the path rather than the spine index, because a preview drops
   * the leading cover pages further down and index-based ids would all shift by
   * one — silently pointing every TOC entry at the wrong chapter.
   */
  const anchorId = (path: string) => `epub-${path.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;

  const chapters: string[] = [];
  /** Which files made it into the spine, so a link can be told from a dead one. */
  const chapterPaths: string[] = [];
  for (const idref of spine) {
    const href = manifest.get(idref);
    if (!href) continue;
    const path = resolveEpubPath(opfDir, href);
    const raw = files[path];
    if (!raw) continue;

    let html = strFromU8(raw);
    // Keep only the body — the client injects this into its own container.
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (body) html = body[1];

    const chapterDir = dirOf(path);
    // Point image references at the asset endpoint so the browser can stream
    // them lazily instead of blocking the text on a multi-MB download.
    html = html.replace(
      /(<(?:img|image)\b[^>]*?\b(?:src|href|xlink:href)=)(["'])(.*?)\2/gi,
      (full, prefix: string, quote: string, src: string) => {
        if (!src || /^(data:|https?:|blob:)/i.test(src)) return full;
        return `${prefix}${quote}${assetUrl(resolveEpubPath(chapterDir, src))}${quote}`;
      },
    );

    // An anchor the book's own table of contents can point at. First child of
    // the chapter, so landing on it puts the heading at the top of the screen.
    html = `<a id="${anchorId(path)}" class="epub-anchor" aria-hidden="true"></a>${html}`;

    chapters.push(html);
    chapterPaths.push(path);
  }

  if (chapters.length === 0) throw new Error("No readable chapters");

  /**
   * Rewrite the book's internal links so they scroll instead of navigating.
   *
   * An EPUB's table of contents links to files — "Text/chapter1.xhtml". The
   * whole book is rendered into ONE page here, so those hrefs resolve against
   * /preview/<slug> and 404. Each becomes a fragment pointing at the chapter's
   * anchor; a link to a file that is not in the spine loses its href entirely
   * rather than staying a trap.
   *
   * Fragment-only links (#note-3) and external ones are left exactly as they
   * are: the first already works in a single page, and the second is the only
   * kind that SHOULD leave.
   */
  const known = new Set(chapterPaths);
  for (let i = 0; i < chapters.length; i++) {
    chapters[i] = chapters[i].replace(
      /(<a\b[^>]*?\bhref=)(["'])(.*?)\2/gi,
      (full, prefix: string, quote: string, href: string) => {
        const value = href.trim();
        if (!value) return full;
        if (/^(https?:|mailto:|tel:|#|data:)/i.test(value)) return full;

        const [file, frag] = value.split("#");
        const target = resolveEpubPath(dirOf(chapterPaths[i] ?? ""), file);
        if (!known.has(target)) {
          // Dead inside this page — drop the href, keep the words.
          return full.replace(/\bhref=(["']).*?\1/i, 'data-epub-dead="1"');
        }
        // Prefer the book's own fragment when it has one: it aims at a heading
        // inside the chapter, which is more precise than the chapter's start.
        return `${prefix}${quote}#${frag ? frag : anchorId(target)}${quote}`;
      },
    );
  }

  // A free preview opens with the splash already showing the cover, so the
  // book's own cover page just repeats it — and because it fills the screen,
  // the visitor has to scroll before seeing a single word. Skip the leading
  // image-only pages so the preview starts on prose. The owner's reader keeps
  // them: they've paid for the whole book, cover included.
  if (opts.dropLeadingImageOnly) {
    const textLength = (html: string) =>
      html.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;|&#\d+;/gi, " ").trim().length;
    let start = 0;
    while (start < chapters.length - 1 && textLength(chapters[start]) < 40) start++;
    if (start > 0) return { chapters: chapters.slice(start) };
  }

  return { chapters };
}
