"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateCustomJs } from "@/lib/actions/site-settings";
import { useEffect, useState } from "react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-medium text-sm hover:opacity-90 disabled:opacity-60 transition-opacity"
    >
      {pending ? "Menyimpan..." : "Simpan"}
    </button>
  );
}

export function CustomJsForm({ initialScript }: { initialScript: string }) {
  const [state, formAction] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) => {
      const script = (formData.get("script") as string) ?? "";
      return updateCustomJs(script);
    },
    null
  );
  const [script, setScript] = useState(initialScript);

  useEffect(() => {
    setScript(initialScript);
  }, [initialScript]);

  return (
    <form action={formAction} className="space-y-4">
      <textarea
        name="script"
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder="// Contoh: console.log('hello');"
        rows={12}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-mono text-foreground placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        spellCheck={false}
      />
      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state?.ok && <span className="text-sm text-green-600">Tersimpan.</span>}
      </div>
    </form>
  );
}
