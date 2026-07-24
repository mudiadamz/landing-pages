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

type FontLevel = "small" | "medium" | "large";
const FONT_SIZES: Record<FontLevel, string> = {
  small: "90%",
  medium: "112%",
  large: "140%",
};
const FONT_KEY = "lp-epub-font";

function readFont(): FontLevel {
  try {
    const v = localStorage.getItem(FONT_KEY);
    if (v === "small" || v === "medium" || v === "large") return v;
  } catch {
    /* storage unavailable */
  }
  return "medium";
}

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
  // ssr:false (see epub-reader), so reading localStorage in the initializer is
  // safe — this component only ever renders on the client.
  const [fontLevel, setFontLevel] = useState<FontLevel>(readFont);

  // Build the book + rendition once per source. Theme + font are applied by the
  // separate effects below (so changing them doesn't reload the book).
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
      // Continuous vertical scroll through the whole book (sections stream in as
      // the reader scrolls) instead of paginated left/right flipping.
      flow: "scrolled",
      manager: "continuous",
      // Sandbox the seller-supplied EPUB — never run scripts it ships with.
      allowScriptedContent: false,
    });
    renditionRef.current = rendition;
    rendition.themes.register("light", THEMES.light);
    rendition.themes.register("dark", THEMES.dark);

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

    return () => {
      destroyed = true;
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

  // Apply + persist the font size (also runs on mount for the initial size).
  useEffect(() => {
    renditionRef.current?.themes.fontSize(FONT_SIZES[fontLevel]);
    try {
      localStorage.setItem(FONT_KEY, fontLevel);
    } catch {
      /* best-effort */
    }
  }, [fontLevel]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fdfcfb] dark:bg-[#141414]">
      <div ref={hostRef} className="h-full w-full" />

      {!loading && !error && <FontSizeControl level={fontLevel} onChange={setFontLevel} />}

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

const FONT_BUTTONS: { level: FontLevel; label: string; cls: string }[] = [
  { level: "small", label: "Kecil", cls: "text-[11px]" },
  { level: "medium", label: "Sedang", cls: "text-sm" },
  { level: "large", label: "Besar", cls: "text-lg" },
];

function FontSizeControl({
  level,
  onChange,
}: {
  level: FontLevel;
  onChange: (l: FontLevel) => void;
}) {
  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--card)]/85 p-0.5 shadow-sm backdrop-blur">
      {FONT_BUTTONS.map((b) => {
        const active = b.level === level;
        return (
          <button
            key={b.level}
            type="button"
            onClick={() => onChange(b.level)}
            aria-pressed={active}
            title={`Font ${b.label}`}
            aria-label={`Ukuran font ${b.label}`}
            className={`flex h-7 w-7 items-center justify-center rounded-full font-semibold leading-none transition-colors ${b.cls} ${
              active
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-foreground"
            }`}
          >
            A
          </button>
        );
      })}
    </div>
  );
}
