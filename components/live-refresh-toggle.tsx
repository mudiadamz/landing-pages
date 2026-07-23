"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Pausable live-refresh control for the stats page. While enabled it re-runs the
 * route's server components every `intervalMs` (default 5s) via router.refresh().
 * It skips ticks when the tab is hidden or unfocused so an idle/background tab
 * never polls the server, and the user can pause it entirely. One request per
 * tick — not a loop.
 */
export function LiveRefreshToggle({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [on, setOn] = useState(true);

  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      if (typeof document === "undefined") return;
      // Only refresh a foreground, focused tab.
      if (document.hidden || (document.hasFocus && !document.hasFocus())) return;
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [on, router, intervalMs]);

  const seconds = Math.round(intervalMs / 1000);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      title={on ? "Jeda pembaruan otomatis" : "Aktifkan pembaruan otomatis"}
      aria-pressed={on}
      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:text-foreground"
    >
      {on ? (
        <>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
          </span>
          Live · tiap {seconds} dtk
        </>
      ) : (
        <>
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
          Jeda — ketuk untuk live
        </>
      )}
    </button>
  );
}
