"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "lp-preview-dark";

// Tiny external store so the dark preference can be read during render without
// a setState-in-effect (project lint forbids it) and without a hydration
// mismatch (server snapshot is always light).
let listeners: Array<() => void> = [];

function readDark(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "1";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

/**
 * Wraps the preview content and provides a dark-mode ("dark reader") toggle.
 *
 * The dark effect is a CSS filter applied ONLY to the wrapped content
 * (iframe / PDF canvas) — it never touches the toolbar, buy CTA, or the host
 * page, so toggling it can't disturb the surrounding UI. Defaults to the
 * device's dark preference on first visit, then remembers the last choice.
 */
export function PreviewSurface({ children }: { children: React.ReactNode }) {
  const dark = useSyncExternalStore(
    subscribe,
    readDark,
    () => false, // server snapshot: always light (avoids hydration mismatch)
  );

  const toggle = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, readDark() ? "0" : "1");
    } catch {
      /* ignore storage failures (private mode) */
    }
    listeners.forEach((l) => l());
  }, []);

  return (
    <>
      <div className={`h-full w-full ${dark ? "preview-dark" : ""}`}>{children}</div>

      <div className="fixed top-4 right-4 z-50 pointer-events-none">
        <div className="pointer-events-auto flex items-center p-1.5 rounded-xl bg-[var(--card)]/90 backdrop-blur border border-[var(--border)] shadow-lg">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={dark}
            aria-label={dark ? "Mode terang" : "Mode gelap"}
            title={dark ? "Mode terang" : "Mode gelap"}
            className="p-1.5 rounded-lg text-foreground hover:bg-[var(--background)] active:scale-95 transition-all duration-150"
          >
            {dark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
