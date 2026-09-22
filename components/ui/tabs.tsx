"use client";

import type { ReactNode } from "react";

export type TabItem = {
  key: string;
  label: ReactNode;
  /** Optional small count/badge after the label. */
  badge?: ReactNode;
};

/**
 * One tab strip for the whole panel. The audit found three treatments — big
 * green cards, underline, and a small segmented control. This is the single
 * underline pattern: an accessible tablist with a moving underline, usable by
 * keyboard (roving semantics via role=tab + aria-selected).
 *
 * Controlled: parent owns `active` and `onChange`. Panels are rendered by the
 * caller (keeps this presentational and free of layout assumptions).
 */
export function Tabs({
  items,
  active,
  onChange,
  className = "",
  ariaLabel,
}: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex gap-1 overflow-x-auto border-b border-[var(--border)] ${className}`}
    >
      {items.map((item) => {
        const selected = item.key === active;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.key)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              selected
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted)] hover:text-foreground"
            }`}
          >
            {item.label}
            {item.badge != null && (
              <span
                className={`rounded-full px-1.5 text-[0.6875rem] ${
                  selected
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "bg-[var(--background)] text-[var(--muted)]"
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
