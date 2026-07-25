"use client";

import { useEffect, useRef, useState } from "react";
import { unzipSync, strFromU8 } from "fflate";
import {
  EPUB_FONT_EVENT,
  EPUB_MARGIN_EVENT,
  clampEpubFont,
  clampEpubMargin,
  readEpubFont,
  readEpubMargin,
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

export default function EpubInlineViewer({
  url,
  storageKey,
}: {
  url: string;
  title?: string;
  /** Reserved for future scroll-position memory. */
  storageKey?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const blobsRef = useRef<string[]>([]);
  const [fontPct, setFontPct] = useState<number>(readEpubFont);
  const [marginPx, setMarginPx] = useState<number>(readEpubMargin);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch + parse + inject the book (no iframe).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
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
  }, [url]);

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
    window.addEventListener(EPUB_FONT_EVENT, onFont);
    window.addEventListener(EPUB_MARGIN_EVENT, onMargin);
    return () => {
      window.removeEventListener(EPUB_FONT_EVENT, onFont);
      window.removeEventListener(EPUB_MARGIN_EVENT, onMargin);
    };
  }, []);

  // Everything is plain CSS now — font size (percent of 16px), horizontal margin
  // (positive = padding inset, negative = pulled past the edges), and theme.
  const pad = Math.max(0, marginPx);
  const neg = Math.min(0, marginPx);

  return (
    <div className="min-h-full w-full bg-[#fdfcfb] text-[#1a1a1a] dark:bg-[#141414] dark:text-[#d4d4d4]">
      <div
        ref={contentRef}
        className="epub-inline mx-auto max-w-3xl"
        style={{
          fontSize: `${(16 * fontPct) / 100}px`,
          paddingLeft: `${pad}px`,
          paddingRight: `${pad}px`,
          marginLeft: neg ? `${neg}px` : undefined,
          marginRight: neg ? `${neg}px` : undefined,
        }}
      />
      {loading && (
        <div className="pointer-events-none flex h-40 items-center justify-center text-sm text-[var(--muted)]">
          Memuat EPUB…
        </div>
      )}
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
