"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { OtherLink } from "@/lib/actions/site-settings";

/**
 * A link icon after the social row, opening a sheet of the owner's other sites.
 *
 * A sheet rather than more icons in the row: a social icon is recognisable from
 * its glyph alone, and these are not — "toko lain" needs its name spelled out.
 * Putting them behind one control keeps the row one line, which is the whole
 * reason the socials lost their labels in the first place.
 *
 * Renders nothing at all when the list is empty, so a storefront that never adds
 * one never grows a button that opens an empty box.
 */
export function OtherLinksButton({ links }: { links: OtherLink[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (links.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Link lainnya (${links.length})`}
        title="Link lainnya"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15 active:scale-[0.96]"
      >
        <LinkIcon className="h-5 w-5" />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            {/* Centred at every size. It was a bottom sheet on phones, which puts
                it in thumb reach but also reads as a system menu rather than as
                this page's own list. */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Link lainnya"
              className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[var(--card)] p-4 shadow-xl sm:p-6"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Link lainnya</h2>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    Situs lain milik kami.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Tutup"
                  className="-mr-1 -mt-1 rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <ul className="space-y-2">
                {links.map((l) => (
                  <li key={`${l.url}-${l.label}`}>
                    <a
                      href={l.url}
                      target="_blank"
                      // noopener because these are somebody else's pages.
                      rel="noopener noreferrer"
                      className="flex min-h-14 items-center gap-3 rounded-xl bg-[var(--accent-subtle)] px-3 py-2.5 transition-colors hover:bg-[var(--primary)]/15 active:bg-[var(--primary)]/25"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {l.label}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                          {l.note || hostOf(l.url)}
                        </span>
                      </span>
                      <span aria-hidden className="shrink-0 text-[var(--muted)]">
                        ↗
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** The domain, as the fallback subtitle — it says where the tap goes. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 13.5a4 4 0 005.66 0l3-3a4 4 0 10-5.66-5.66l-1 1"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 10.5a4 4 0 00-5.66 0l-3 3a4 4 0 105.66 5.66l1-1"
      />
    </svg>
  );
}
