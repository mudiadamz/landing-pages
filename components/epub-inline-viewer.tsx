"use client";

import { useEffect, useRef, useState } from "react";
import { unzipSync, strFromU8 } from "fflate";
import { markBookReady } from "@/lib/boot-splash";


import {
  EPUB_ALIGN_EVENT,
  EPUB_FONT_EVENT,
  EPUB_MARGIN_EVENT,
  clampEpubAlign,
  clampEpubFont,
  clampEpubMargin,
  readEpubAlign,
  readEpubFont,
  readEpubMargin,
  type EpubAlign,
} from "@/lib/epub-font";

const IMG_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
};

const dirOf = (p: string) => p.split("/").slice(0, -1).join("/");

/** Words per minute for Indonesian prose — deliberately conservative. */
const WPM = 200;

const countWords = (text: string) => {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
};

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

/**
 * Parse an EPUB (zip) and return combined, sanitized chapter HTML — rendered
 * directly in the page DOM (no iframe). Image references are rewritten to blob
 * URLs from the archive; scripts/styles/links are stripped (we apply our own
 * reading typography).
 */
function buildEpubHtml(bytes: Uint8Array): { html: string; blobs: string[] } {
  const files = unzipSync(bytes);
  const blobs: string[] = [];
  const blobCache = new Map<string, string>();

  const blobFor = (path: string): string | null => {
    if (blobCache.has(path)) return blobCache.get(path)!;
    const data = files[path];
    if (!data) return null;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const type = IMG_MIME[ext] ?? "application/octet-stream";
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
    blobCache.set(path, url);
    blobs.push(url);
    return url;
  };

  // container.xml → OPF path
  const container = strFromU8(files["META-INF/container.xml"] ?? new Uint8Array());
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath || !files[opfPath]) throw new Error("OPF not found");
  const opfDir = dirOf(opfPath);
  const opf = strFromU8(files[opfPath]);

  // manifest (id → href) + spine order
  const manifest = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const tag = m[0];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) manifest.set(id, href);
  }
  const spine = [...opf.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/g)].map((m) => m[1]);

  const parser = new DOMParser();
  const chapters: string[] = [];

  for (const idref of spine) {
    const href = manifest.get(idref);
    if (!href) continue;
    const path = resolvePath(opfDir, href);
    const raw = files[path];
    if (!raw) continue;
    try {
      const doc = parser.parseFromString(strFromU8(raw), "text/html");
      const body = doc.body;
      if (!body) continue;

      // Strip dangerous / unwanted nodes.
      body.querySelectorAll("script, style, link, title, meta, base, iframe, object, embed").forEach((n) =>
        n.remove(),
      );
      // Remove event handlers + javascript: urls.
      body.querySelectorAll("*").forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
          if (/^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
        }
      });
      // Rewrite <img> sources to archive blob URLs.
      body.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src");
        if (!src || /^(data:|https?:|blob:)/i.test(src)) return;
        const url = blobFor(resolvePath(dirOf(path), src));
        if (url) img.setAttribute("src", url);
        else img.remove();
        img.removeAttribute("loading");
      });
      // SVG <image xlink:href> / <image href>.
      body.querySelectorAll("image").forEach((im) => {
        const href2 = im.getAttribute("xlink:href") || im.getAttribute("href");
        if (!href2 || /^(data:|https?:|blob:)/i.test(href2)) return;
        const url = blobFor(resolvePath(dirOf(path), href2));
        if (url) {
          im.setAttribute("href", url);
          im.removeAttribute("xlink:href");
        }
      });

      chapters.push(`<section class="epub-chapter">${body.innerHTML}</section>`);
    } catch {
      /* skip an unreadable chapter */
    }
  }

  if (chapters.length === 0) throw new Error("No readable chapters");
  return { html: chapters.join("\n"), blobs };
}

/**
 * Sanitize raw chapter markup that the server already unzipped. Mirrors the
 * client-side path in buildEpubHtml: strip scripts/handlers, keep images (they
 * point at /api/epub-asset and stream in lazily after the text has painted).
 */
function sanitizeChapters(chapters: string[]): string {
  const parser = new DOMParser();
  const out: string[] = [];
  for (const raw of chapters) {
    try {
      const doc = parser.parseFromString(`<body>${raw}</body>`, "text/html");
      const body = doc.body;
      if (!body) continue;
      body
        .querySelectorAll("script, style, link, title, meta, base, iframe, object, embed")
        .forEach((n) => n.remove());
      body.querySelectorAll("*").forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
          if (/^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
        }
      });
      // Never let a picture block the words.
      body.querySelectorAll("img").forEach((img) => {
        img.setAttribute("loading", "lazy");
        img.setAttribute("decoding", "async");
      });
      out.push(`<section class="epub-chapter">${body.innerHTML}</section>`);
    } catch {
      /* skip an unreadable chapter */
    }
  }
  if (out.length === 0) throw new Error("No readable chapters");
  return out.join("\n");
}

export default function EpubInlineViewer({
  url,
  slug,
  textEndpoint,
  storageKey,
}: {
  url: string;
  /** When set, fetch pre-unzipped chapters from the server (much faster). */
  slug?: string;
  /** Override the chapter source — the owner's reader uses a gated endpoint. */
  textEndpoint?: string;
  title?: string;
  /** Reserved for future scroll-position memory. */
  storageKey?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const blobsRef = useRef<string[]>([]);
  const [fontPct, setFontPct] = useState<number>(readEpubFont);
  const [marginPx, setMarginPx] = useState<number>(readEpubMargin);
  const [align, setAlign] = useState<EpubAlign>(readEpubAlign);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Chapter count + reading time for the identity line (see below). Set in the
  // same state batch as `loading`, so it paints WITH the first words rather than
  // dropping in afterwards and shoving the opening line down the screen.
  const [meta, setMeta] = useState<{ chapters: number; words: number } | null>(null);

  // Fetch + parse + inject the book (no iframe).
  //
  // Fast path: the server hands us just the chapter markup (tens of KB) with
  // images pointed at /api/epub-asset, so the first words paint almost at once.
  // Fallback: download and unzip the whole archive in the browser — correct but
  // slow, since a book's images can dwarf its text.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const chapterUrl = textEndpoint ?? (slug ? `/api/epub-text/${encodeURIComponent(slug)}` : null);
      if (chapterUrl) {
        try {
          const res = await fetch(chapterUrl);
          if (res.ok) {
            const { chapters } = (await res.json()) as { chapters: string[] };
            const html = sanitizeChapters(chapters);
            if (cancelled) return;
            if (contentRef.current) contentRef.current.innerHTML = html;
            // innerHTML is synchronous, so the text is readable right away.
            setMeta({
              chapters: chapters.length,
              words: countWords(contentRef.current?.textContent ?? ""),
            });
            setLoading(false);
            return;
          }
        } catch {
          /* fall through to the client-side unzip */
        }
        if (cancelled) return;
      }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const { html, blobs } = buildEpubHtml(bytes);
        if (cancelled) {
          blobs.forEach(URL.revokeObjectURL);
          return;
        }
        blobsRef.current = blobs;
        if (contentRef.current) contentRef.current.innerHTML = html;
        setMeta({
          chapters: contentRef.current?.querySelectorAll(".epub-chapter").length ?? 0,
          words: countWords(contentRef.current?.textContent ?? ""),
        });
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Gagal memuat EPUB.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      blobsRef.current.forEach(URL.revokeObjectURL);
      blobsRef.current = [];
    };
  }, [url, slug, textEndpoint]);

  // Hand off from the cover to the book.
  useEffect(() => {
    if (!loading || error) markBookReady();
  }, [loading, error]);

  // Follow font-size / margin changes broadcast from the actions menu.
  useEffect(() => {
    const onFont = (e: Event) => {
      const pct = (e as CustomEvent).detail as number;
      if (typeof pct === "number") setFontPct(clampEpubFont(pct));
    };
    const onMargin = (e: Event) => {
      const px = (e as CustomEvent).detail as number;
      if (typeof px === "number") setMarginPx(clampEpubMargin(px));
    };
    const onAlign = (e: Event) => setAlign(clampEpubAlign((e as CustomEvent).detail));
    window.addEventListener(EPUB_FONT_EVENT, onFont);
    window.addEventListener(EPUB_MARGIN_EVENT, onMargin);
    window.addEventListener(EPUB_ALIGN_EVENT, onAlign);
    return () => {
      window.removeEventListener(EPUB_FONT_EVENT, onFont);
      window.removeEventListener(EPUB_MARGIN_EVENT, onMargin);
      window.removeEventListener(EPUB_ALIGN_EVENT, onAlign);
    };
  }, []);

  // Everything is plain CSS now — font size (percent of 16px), horizontal margin
  // (positive = padding inset, negative = pulled past the edges), and theme.
  const pad = Math.max(0, marginPx);
  const neg = Math.min(0, marginPx);

  // One quiet line telling the visitor what they've opened: how many chapters,
  // and how long it takes to read. Nearly half of paid visitors used to leave
  // without learning this was a book at all, and the fix for that was to show
  // text instead of a cover — but a wall of prose still doesn't announce its
  // shape. This does, in the words' own typeface, costing one line.
  //
  // It stays in the flow and simply scrolls away: fading it out would mean
  // removing a laid-out element while someone is reading the line beneath it.
  // Derived from the book itself — no genre label, because nothing in the schema
  // actually records the format, and a guessed "Novel" would sometimes be a lie.
  const identity = (() => {
    if (!meta || meta.words === 0) return null;
    const minutes = Math.max(1, Math.round(meta.words / WPM));
    const readTime = `±${minutes} menit baca`;
    return meta.chapters > 1 ? `${meta.chapters} bab · ${readTime}` : readTime;
  })();

  return (
    <div className="epub-surface min-h-full w-full">
      {identity && (
        <p className="epub-identity mx-auto max-w-3xl" style={{ paddingLeft: pad, paddingRight: pad }}>
          {identity}
        </p>
      )}
      <div
        ref={contentRef}
        className="epub-inline mx-auto max-w-3xl"
        style={{
          textAlign: align,
          fontSize: `${(19 * fontPct) / 100}px`,
          paddingLeft: `${pad}px`,
          paddingRight: `${pad}px`,
          marginLeft: neg ? `${neg}px` : undefined,
          marginRight: neg ? `${neg}px` : undefined,
        }}
      />
      {error && (
        <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-red-500">
          {error}
        </div>
      )}
      {/* Reserve space so the last lines clear the floating buy bar. */}
      {!loading && !error && <div aria-hidden style={{ height: 96 }} />}
      {/* storageKey reserved for future scroll memory */}
      <span hidden>{storageKey}</span>
    </div>
  );
}
