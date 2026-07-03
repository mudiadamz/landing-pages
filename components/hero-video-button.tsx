"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Extract an 11-char YouTube id from watch/embed/youtu.be URLs. */
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

const PlayIcon = (
  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent-subtle)] text-[var(--primary)]">
    <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  </span>
);

export function HeroVideoButton({ label, href }: { label: string; href: string }) {
  const [open, setOpen] = useState(false);
  const vid = youtubeId(href);

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

  // Not a YouTube link → behave as a normal link button.
  if (!vid) {
    return (
      <Button
        size="lg"
        variant="secondary"
        href={href}
        external={/^https?:\/\//.test(href)}
        rightIcon={PlayIcon}
        className="gap-2"
      >
        {label}
      </Button>
    );
  }

  return (
    <>
      <Button size="lg" variant="secondary" onClick={() => setOpen(true)} rightIcon={PlayIcon} className="gap-2">
        {label}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Video tutorial"
        >
          <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup"
              className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${vid}?autoplay=1&rel=0`}
                title="Video tutorial"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
