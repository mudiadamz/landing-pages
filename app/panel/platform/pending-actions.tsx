"use client";

import { useState, useTransition } from "react";
import { approveBusiness, rejectBusiness } from "@/lib/actions/business-apply";

/**
 * Approve / reject buttons for a pending business (Fase 4). Kept tiny and local:
 * the Platform overview is a server component, and only the two actions here need
 * to be interactive. A rejected/approved row re-renders via revalidatePath.
 */
export function PendingActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action(id);
      if (!res.ok) setError(res.error ?? "Gagal.");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(approveBusiness)}
        className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
      >
        Setujui
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(rejectBusiness)}
        className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-foreground disabled:opacity-50"
      >
        Tolak
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
