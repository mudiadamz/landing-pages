"use client";

import { useActionState } from "react";
import { updateCustomJs } from "@/lib/actions/site-settings";
import { useEffect, useState } from "react";
import { SaveBar } from "@/components/ui/save-bar";
import { useT } from "@/lib/i18n/client";

export function CustomJsForm({ initialScript, siteId }: { initialScript: string; siteId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) => {
      const script = (formData.get("script") as string) ?? "";
      return updateCustomJs(script, siteId);
    },
    null
  );
  const [script, setScript] = useState(initialScript);

  useEffect(() => {
    setScript(initialScript);
  }, [initialScript]);

  const dirty = script !== initialScript;

  function handleSave() {
    const fd = new FormData();
    fd.set("script", script);
    formAction(fd);
  }

  return (
    <form action={formAction} className="space-y-4">
      <textarea
        name="script"
        value={script}
        onChange={(e) => setScript(e.target.value)}
        aria-label={t("panel.titleCustomJs")}
        placeholder={t("panel.customJsPlaceholder")}
        rows={12}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base sm:text-sm font-mono text-foreground placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        spellCheck={false}
      />
      <SaveBar
        dirty={dirty}
        saving={pending}
        onSave={handleSave}
        saveLabel={t("common.save")}
        savingLabel={t("common.saving")}
        unsavedLabel={t("common.unsavedChanges")}
        saved={!!state?.ok}
        savedLabel={t("common.saved")}
        error={state?.error ?? null}
      />
    </form>
  );
}
