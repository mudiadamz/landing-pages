"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

/**
 * Swipeable product images for the checkout hero. Scroll-snap does the work, so
 * a phone swipe behaves natively and the whole thing still works with
 * JavaScript disabled — the dots and arrows only enhance it.
 *
 * A single image renders as a plain picture, with no controls to get in the way.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const scrollTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  }, []);

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIndex((prev) => (prev === i ? prev : i));
  }, []);

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className="relative aspect-video bg-[var(--background)]">
        <Image
          src={images[0]}
          alt={alt}
          fill
          sizes="(max-width: 640px) 100vw, 576px"
          className="object-cover"
          priority
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-[var(--background)]">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <div key={src} className="relative h-full w-full shrink-0 snap-center">
            <Image
              src={src}
              alt={i === 0 ? alt : `${alt} — gambar ${i + 1}`}
              fill
              sizes="(max-width: 640px) 100vw, 576px"
              className="object-cover"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {/* Arrows: pointer devices only — on a phone you just swipe. */}
      <button
        type="button"
        onClick={() => scrollTo(Math.max(0, index - 1))}
        disabled={index === 0}
        aria-label="Gambar sebelumnya"
        className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white backdrop-blur transition-opacity hover:bg-black/60 disabled:opacity-0 sm:block"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => scrollTo(Math.min(images.length - 1, index + 1))}
        disabled={index === images.length - 1}
        aria-label="Gambar berikutnya"
        className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white backdrop-blur transition-opacity hover:bg-black/60 disabled:opacity-0 sm:block"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`Ke gambar ${i + 1}`}
            aria-current={i === index}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-5 bg-white" : "w-1.5 bg-white/60 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
