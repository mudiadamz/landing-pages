"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export type MenuSearchItem = { label: string; href: string; group?: string };

/**
 * Ctrl/Cmd-K menu search (audit: 26 items, only ~14 fit before scrolling). A flat,
 * filterable list of the menus the current user can actually see — passed in so
 * visibility rules stay in one place (the sidebar). Keyboard: Cmd/Ctrl+K to open,
 * type to filter, ↑/↓ to move, Enter to go, Esc to close.
 */
export function MenuSearch({
  items,
  label,
  placeholder,
}: {
  items: MenuSearchItem[];
  label: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Focus after the portal paints.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  function go(item: MenuSearchItem | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:border-[var(--primary)]/40 hover:text-foreground"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <span className="flex-1 text-left">{label}</span>
        <kbd className="hidden shrink-0 rounded border border-[var(--border)] px-1.5 text-[0.625rem] font-medium text-[var(--muted)] md:inline">
          ⌘K
        </kbd>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-[12vh]">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={label}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    go(results[active]);
                  } else if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                placeholder={placeholder}
                aria-label={placeholder}
                className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-sm text-foreground focus:outline-none"
              />
              <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
                {results.map((item, i) => (
                  <li key={item.href}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                        i === active
                          ? "bg-[var(--accent-subtle)] text-[var(--primary)]"
                          : "text-foreground hover:bg-[var(--background)]"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.group && (
                        <span className="shrink-0 text-[0.6875rem] text-[var(--muted)]">{item.group}</span>
                      )}
                    </button>
                  </li>
                ))}
                {results.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-[var(--muted)]">—</li>
                )}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
