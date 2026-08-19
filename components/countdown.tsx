"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Parts = { d: number; h: number; m: number; s: number; done: boolean };

function partsUntil(target: number): Parts {
  const diff = Math.max(0, target - Date.now());
  const totalSec = Math.floor(diff / 1000);
  return {
    d: Math.floor(totalSec / 86400),
    h: Math.floor((totalSec % 86400) / 3600),
    m: Math.floor((totalSec % 3600) / 60),
    s: totalSec % 60,
    done: diff <= 0,
  };
}

/**
 * Live countdown to an absolute instant (ISO string). Ticks every second and,
 * the moment it hits zero, refreshes the route so the now-released product
 * unlocks (the server re-evaluates the upcoming gate). Renders a placeholder
 * until mounted to avoid a server/client time mismatch on first paint.
 */
export function Countdown({ target }: { target: string }) {
  const router = useRouter();
  const targetMs = new Date(target).getTime();
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    const tick = () => {
      const next = partsUntil(targetMs);
      setParts(next);
      if (next.done) {
        clearInterval(id);
        // Give the server a beat to cross the boundary, then reveal the product.
        setTimeout(() => router.refresh(), 800);
      }
    };
    // tick only runs asynchronously (next frame / each second), by which point
    // `id` is assigned — so the closure reference above is safe.
    const id = setInterval(tick, 1000);
    // First value on the next frame (not synchronously in the effect body) so
    // the initial paint stays a server/client-agnostic placeholder.
    const raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [targetMs, router]);

  const cells: { value: number; label: string }[] = [
    { value: parts?.d ?? 0, label: "Hari" },
    { value: parts?.h ?? 0, label: "Jam" },
    { value: parts?.m ?? 0, label: "Menit" },
    { value: parts?.s ?? 0, label: "Detik" },
  ];

  return (
    <div className="flex items-stretch justify-center gap-2 sm:gap-3" aria-live="polite">
      {cells.map((c, i) => (
        <div
          key={i}
          className="flex min-w-[64px] flex-col items-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 shadow-sm sm:min-w-[76px]"
        >
          <span className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
            {String(c.value).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[0.625rem] font-medium uppercase tracking-wide text-[var(--muted)] sm:text-xs">
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}
