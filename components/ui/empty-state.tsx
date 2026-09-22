import type { ReactNode } from "react";

/**
 * One empty state for the whole panel. The audit found three different treatments
 * — grey card with copy, grey card without, and a bright green card — plus an API
 * error rendered as if it were empty. This is the single grey-card pattern: an
 * optional icon, a title, one explanatory line, and one optional action.
 *
 * Presentational and server-safe (no "use client"): pass the action as a node —
 * a <Link>, or a client button — so the card itself never needs an event handler.
 * For a failed load use <ErrorState> instead, which is a deliberately different
 * shape so "nothing here" and "it broke" never look the same.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm sm:p-12 ${className}`}
    >
      {icon && (
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--primary)]">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--muted)]">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
