"use client";

import { useEffect, useRef, useState } from "react";
import ePub, { type Rendition } from "epubjs";
import { useTheme } from "@/lib/use-theme";

// Content-document themes applied inside the EPUB's sandboxed iframe. EPUB themes
// natively (unlike PDF, which needs a separate dark file) — we just re-select on
// toggle, no reload.
// Tight gutters so the text column uses nearly the full width — the theme
// stylesheet is injected after the book's own CSS, so these win by cascade
// order and neutralise large default body margins.
const BODY_GUTTER = {
  margin: "0",
  "padding-top": "0.25rem",
  "padding-bottom": "0.25rem",
  "padding-left": "0.5rem",
  "padding-right": "0.5rem",
} as const;

const THEMES = {
  light: {
    body: { background: "#fdfcfb", color: "#1a1a1a", ...BODY_GUTTER },
    a: { color: "#2563eb" },
  },
  dark: {
    body: { background: "#141414", color: "#d4d4d4", ...BODY_GUTTER },
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
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute left-3 top-3 z-20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Ukuran font"
        aria-label="Ukuran font"
        className="flex h-8 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)]/85 px-2.5 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-[var(--card)]"
      >
        <span className="text-xs font-semibold leading-none">A</span>
        <span className="text-base font-semibold leading-none">A</span>
        <svg
          className={`h-3.5 w-3.5 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute left-0 top-10 z-20 w-36 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
          >
            <p className="px-2.5 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Ukuran font
            </p>
            {FONT_BUTTONS.map((b) => {
              const active = b.level === level;
              return (
                <button
                  key={b.level}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onChange(b.level);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                    active ? "bg-[var(--primary)]/10" : "hover:bg-[var(--background)]"
                  }`}
                >
                  <span className={`${b.cls} font-medium ${active ? "text-[var(--primary)]" : "text-foreground"}`}>
                    {b.label}
                  </span>
                  {active && (
                    <svg className="h-4 w-4 shrink-0 text-[var(--primary)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
