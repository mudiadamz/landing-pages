"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateTracking } from "@/lib/actions/site-settings";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" loading={pending} disabled={pending} className="hover:opacity-90 disabled:opacity-60">
      {pending ? "Menyimpan..." : "Simpan"}
    </Button>
  );
}

export function TrackingForm({ initialGtmId }: { initialGtmId: string }) {
  const [state, formAction] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) => {
      const gtmId = (formData.get("gtmId") as string) ?? "";
      return updateTracking({ gtmId });
    },
    null,
  );
  const [gtmId, setGtmId] = useState(initialGtmId);

  useEffect(() => {
    setGtmId(initialGtmId);
  }, [initialGtmId]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="gtmId" className="mb-1 block text-sm font-medium text-foreground">
          GTM Container ID
        </label>
        <input
          id="gtmId"
          name="gtmId"
          value={gtmId}
          onChange={(e) => setGtmId(e.target.value)}
          placeholder="GTM-XXXXXXX"
          autoComplete="off"
          spellCheck={false}
          className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">Kosongkan untuk menonaktifkan GTM.</p>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state?.ok && <span className="text-sm text-green-600">Tersimpan.</span>}
      </div>
    </form>
  );
}
