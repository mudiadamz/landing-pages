"use client";

import { useEffect, useRef, useState } from "react";
import ePub, { type Rendition } from "epubjs";
import { useTheme } from "@/lib/use-theme";

// Content-document themes applied inside the EPUB's sandboxed iframe. EPUB themes
// natively (unlike PDF, which needs a separate dark file) — we just re-select on
// toggle, no reload.
const THEMES = {
  light: {
    body: { background: "#fdfcfb", color: "#1a1a1a" },
    a: { color: "#2563eb" },
  },
  dark: {
    body: { background: "#141414", color: "#d4d4d4" },
    a: { color: "#8ab4f8" },
  },
} as const;

export default function EpubViewer({
  url,
  storageKey,
}: {
  url: string;
  title?: string;
  /** Stable key to remember the reading position (CFI) across reloads. */
  storageKey?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const { dark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build the book + rendition once per source. Theme is applied by the separate
  // effect below (so toggling doesn't reload the book).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let destroyed = false;

    let saved: string | null = null;
    try {
      saved = storageKey ? sessionStorage.getItem(storageKey) : null;
    } catch {
      /* storage unavailable (private mode) — position memory is best-effort */
    }

    const book = ePub(url);
    const rendition = book.renderTo(host, {
      width: "100%",
      height: "100%",
      spread: "auto",
      // Sandbox the seller-supplied EPUB — never run scripts it ships with.
      allowScriptedContent: false,
    });
    renditionRef.current = rendition;
    rendition.themes.register("light", THEMES.light);
    rendition.themes.register("dark", THEMES.dark);
    rendition.themes.fontSize("112%");

    rendition
      .display(saved || undefined)
      .then(() => {
        if (!destroyed) setLoading(false);
      })
      .catch(() => {
        if (!destroyed) {
          setError("Gagal memuat EPUB.");
          setLoading(false);
        }
      });

    rendition.on("relocated", (loc: { start?: { cfi?: string } }) => {
      try {
        if (storageKey && loc?.start?.cfi) sessionStorage.setItem(storageKey, loc.start.cfi);
      } catch {
        /* best-effort */
      }
    });

    // Arrow-key paging, both when focus is inside the reader iframe and outside.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") rendition.prev();
      else if (e.key === "ArrowRight") rendition.next();
    };
    rendition.on("keyup", onKey);
    document.addEventListener("keyup", onKey);

    return () => {
      destroyed = true;
      document.removeEventListener("keyup", onKey);
      try {
        book.destroy();
      } catch {
        /* ignore teardown errors */
      }
      renditionRef.current = null;
    };
  }, [url, storageKey]);

  // Re-theme on toggle (also runs on mount to set the initial theme).
  useEffect(() => {
    renditionRef.current?.themes.select(dark ? "dark" : "light");
  }, [dark]);

  const page = (dir: "prev" | "next") => {
    const r = renditionRef.current;
    if (!r) return;
    if (dir === "prev") r.prev();
    else r.next();
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fdfcfb] dark:bg-[#141414]">
      <div ref={hostRef} className="h-full w-full" />

      {!loading && !error && (
        <>
          <NavButton side="left" onClick={() => page("prev")} />
          <NavButton side="right" onClick={() => page("next")} />
        </>
      )}

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]">
          Memuat EPUB…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Halaman sebelumnya" : "Halaman berikutnya"}
      className={`group absolute top-0 bottom-0 z-10 flex w-12 items-center justify-center ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--card)]/70 text-[var(--muted)] opacity-0 shadow-sm ring-1 ring-[var(--border)] backdrop-blur transition-opacity group-hover:opacity-100">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={side === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
          />
        </svg>
      </span>
    </button>
  );
}
