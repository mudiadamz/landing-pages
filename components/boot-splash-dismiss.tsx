"use client";

import { useEffect } from "react";
import { markBookReady } from "@/lib/boot-splash";

/**
 * Retires the cover splash for previews that aren't the EPUB reader (HTML, PDF,
 * external link) — those bring their own loading UI, and the shell flushes the
 * splash before it knows which kind of preview this is.
 */
export function BootSplashDismiss() {
  useEffect(() => {
    markBookReady(true);
  }, []);
  return null;
}
