"use client";

import { useCallback, useSyncExternalStore } from "react";

// Single source of truth for dark mode across the whole app (front, panel,
// preview, story reader). The "dark" state lives on <html class="dark">, mirrored
// to localStorage + a cookie so it survives reloads and is available to the
// server (see app/layout.tsx). Every consumer subscribes to the same store, so
// toggling in any surface updates all of them in sync.

const STORAGE_KEY = "theme";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

let listeners: Array<() => void> = [];

function isDarkNow(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function subscribe(cb: () => void) {
  listeners.push(cb);
  // Keep other tabs in sync when the theme changes there.
  window.addEventListener("storage", cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
    window.removeEventListener("storage", cb);
  };
}

/** Apply a theme everywhere and notify all subscribers in this tab. */
export function setTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  const value = dark ? "dark" : "light";
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore (private mode) */
  }
  document.cookie = `theme=${value};path=/;max-age=${COOKIE_MAX_AGE};sameSite=Lax`;
  listeners.forEach((l) => l());
}

/** Reactive access to the shared dark-mode state. */
export function useTheme() {
  const dark = useSyncExternalStore(
    subscribe,
    isDarkNow,
    () => false, // server snapshot: layout renders the real class; avoids mismatch
  );
  const toggle = useCallback(() => setTheme(!isDarkNow()), []);
  return { dark, toggle, setTheme };
}
