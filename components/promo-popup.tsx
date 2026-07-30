"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PromoPopup as PromoConfig } from "@/lib/promo-config";

/**
 * Promotional image over the product preview.
 *
 * Written around one rule: the preview must not get slower. The preview is the
 * page this business is judged on, and it has already been paid for once —
 * a blank reader while a 3.42 MB EPUB parsed cost an entire ad campaign. So:
 *
 *  - No <img> is emitted until the popup actually opens, so the promo image is
 *    never part of the initial HTML and never competes for bandwidth with the
 *    preview itself.
 *  - The countdown starts on the window `load` event, not on mount. `load`
 *    waits for iframes, which is exactly what the preview is — so the timer
 *    begins when the visitor can genuinely see content, never over a spinner.
 *  - The image is warmed ~1.5s before it is shown, well after load, so it
 *    paints instantly without a flash and without touching the critical path.
 *
 * Timing default (8s) comes from this site's preview telemetry: it is the last
 * point that still reaches every "curious" and "read" visitor while firing for
 * only ~21% of people who were leaving anyway.
 */

const SEEN_KEY = "lp-promo-seen";
const WARM_LEAD_MS = 1500;

export function PromoPopup({ config, slug }: { config: PromoConfig; slug: string }) {
  const [open, setOpen] = useState(false);
  const closedRef = useRef(false);

  const show = useCallback(() => {
    if (closedRef.current || open) return;
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Private mode or storage disabled — showing once per page load is a fine
      // fallback; failing to render at all would be worse.
    }
    setOpen(true);
  }, [open]);

  useEffect(() => {
    // Already dismissed this session? Never arm anything.
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
    } catch {
      /* ignore */
    }

    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let warmTimer: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      warmTimer = setTimeout(
        () => {
          // Warm the cache off the critical path. A detached Image() never
          // blocks paint and is discarded if the popup is closed first.
          const img = new Image();
          img.decoding = "async";
          img.src = config.imageUrl;
        },
        Math.max(0, config.delayMs - WARM_LEAD_MS),
      );
      delayTimer = setTimeout(show, config.delayMs);
    };

    // The preview is an iframe; window `load` fires only once it has loaded too.
    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });

    const onExit = (e: MouseEvent) => {
      // Pointer leaving through the top of the viewport — the tab-closing
      // gesture. Ignored on touch, where there is no such signal.
      if (e.clientY <= 0) show();
    };
    if (config.exitIntent) document.addEventListener("mouseout", onExit);

    return () => {
      clearTimeout(delayTimer);
      clearTimeout(warmTimer);
      window.removeEventListener("load", arm);
      document.removeEventListener("mouseout", onExit);
    };
  }, [config.delayMs, config.exitIntent, config.imageUrl, show]);

  const close = useCallback(() => {
    closedRef.current = true;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const img = (
    // Plain <img>, not next/image: the file is already an optimised WebP, so
    // routing it through the image optimiser would add a hop and re-encode
    // something that is finished. Dimensions come from the WebP header at
    // upload time, so the box is reserved and nothing shifts.
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={config.imageUrl}
      alt={config.alt}
      width={config.width || undefined}
      height={config.height || undefined}
      decoding="async"
      className="block h-auto w-full rounded-xl"
    />
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={config.alt || "Promo"}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 promo-fade"
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Tutup promo"
          className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-800 shadow-lg transition-transform active:scale-95 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {config.href ? (
          <a
            href={config.href}
            target={config.href.startsWith("/") ? undefined : "_blank"}
            rel="noopener noreferrer"
            onClick={close}
            data-promo-slug={slug}
          >
            {img}
          </a>
        ) : (
          img
        )}
      </div>

      <style>{`
        .promo-fade { animation: promoFade .18s ease-out }
        @keyframes promoFade { from { opacity: 0 } to { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .promo-fade { animation: none } }
      `}</style>
    </div>
  );
}
