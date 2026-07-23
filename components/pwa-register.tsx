"use client";

import { useEffect } from "react";

/** Registers the minimal service worker so the site becomes installable. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration is best-effort — the site works fine without it */
    });
  }, []);
  return null;
}
