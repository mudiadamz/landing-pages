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
  // Enable/disable without losing the draft: when off we save an empty script
  // (the storefront stops running it) but keep the text in the editor so it can
  // be switched back on. Starts on iff there is a saved script.
  const [enabled, setEnabled] = useState(initialScript.trim().length > 0);

  useEffect(() => {
    setScript(initialScript);
    setEnabled(initialScript.trim().length > 0);
  }, [initialScript]);

  // What actually gets saved — empty when disabled.
  const effectiveScript = enabled ? script : "";
  const dirty = effectiveScript !== initialScript;

  function handleSave() {
    if (enabled && !window.confirm(t("panel.customJsSaveConfirm"))) return;
    const fd = new FormData();
    fd.set("script", effectiveScript);
    formAction(fd);
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/15 dark:text-amber-200">
        {t("panel.customJsWarning")}
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-5 w-5 accent-[var(--primary)]"
        />
        {t("panel.customJsEnabled")}
      </label>

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
