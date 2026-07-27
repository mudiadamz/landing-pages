"use client";

import { useEffect, useRef } from "react";

export type ChapterItem = {
  /** The section element in the reader — scrolled to on selection. */
  el: HTMLElement;
  /** "Bab 1" and similar, when the book's own markup provides it. */
  num?: string;
  label: string;
  /** Which page of the readout this chapter opens on. */
  page: number;
};

/**
 * Chapter list for the reader, opened from the page readout at the bottom.
 *
 * A bottom sheet rather than a dropdown: the trigger is at the bottom edge of a
 * phone screen, and a list that grows upward from the thumb is reachable one-
 * handed. Long books scroll inside it, and the chapter being read is marked so
 * opening the sheet answers "where am I" as well as "where can I go".
 */
export function ReaderChapterSheet({
  items,
  currentIndex,
  onSelect,
  onClose,
}: {
  items: ChapterItem[];
  currentIndex: number;
  onSelect: (item: ChapterItem, index: number) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  // Escape closes. Captured, because the preview guard also listens on keydown.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Open onto the current chapter, not the top of a 50-chapter list.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
    panelRef.current?.focus();
  }, []);

  return (
    <div className="reader-toc-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Daftar bab"
        tabIndex={-1}
        className="reader-toc"
        // The backdrop closes on click; taps inside the sheet must not bubble to it.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reader-toc-head">
          <span className="reader-toc-title">Daftar bab</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup daftar bab"
            className="reader-toc-close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <ul className="reader-toc-list">
          {items.map((item, i) => {
            const current = i === currentIndex;
            return (
              <li key={i}>
                <button
                  ref={current ? currentRef : undefined}
                  type="button"
                  onClick={() => onSelect(item, i)}
                  aria-current={current ? "true" : undefined}
                  className={`reader-toc-item${current ? " is-current" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    {item.num && <span className="reader-toc-num">{item.num}</span>}
                    <span className="reader-toc-label">{item.label}</span>
                  </span>
                  <span className="reader-toc-page">{item.page}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
