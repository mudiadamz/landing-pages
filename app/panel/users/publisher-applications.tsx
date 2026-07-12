"use client";

import { useState, useTransition } from "react";
import { approvePublisher, rejectPublisher, type PublisherApplication } from "@/lib/actions/admin";

export function PublisherApplications({ initial }: { initial: PublisherApplication[] }) {
  const [apps, setApps] = useState<PublisherApplication[]>(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function act(id: string, fn: typeof approvePublisher) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const res = await fn(id);
      if (res.ok) {
        setApps((prev) => prev.filter((a) => a.id !== id));
      } else {
        setError(res.error ?? "Gagal.");
      }
      setPendingId(null);
    });
  }

  if (apps.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 shadow-sm dark:border-amber-800/50 dark:bg-amber-900/15">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Pengajuan publisher</h2>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-800/50 dark:text-amber-200">
          {apps.length}
        </span>
      </div>

      <div className="space-y-2">
        {apps.map((a) => (
          <div
            key={a.id}
            className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{a.full_name || "—"}</p>
              <p className="truncate text-sm text-[var(--muted)]">{a.email || "—"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => act(a.id, approvePublisher)}
                disabled={pendingId === a.id}
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pendingId === a.id ? "…" : "Setujui"}
              </button>
              <button
                type="button"
                onClick={() => act(a.id, rejectPublisher)}
                disabled={pendingId === a.id}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-red-600 disabled:opacity-50"
              >
                Tolak
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
