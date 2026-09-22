"use client";

import { useActionState, useState } from "react";
import { updateTracking } from "@/lib/actions/site-settings";
import { SaveBar } from "@/components/ui/save-bar";
import { useT } from "@/lib/i18n/client";

export function TrackingForm({
  initialGtmId,
  initialTawkPropertyId,
  initialTawkWidgetId,
  siteId,
}: {
  initialGtmId: string;
  initialTawkPropertyId: string;
  initialTawkWidgetId: string;
  siteId: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) => {
      const gtmId = (formData.get("gtmId") as string) ?? "";
      const tawkPropertyId = (formData.get("tawkPropertyId") as string) ?? "";
      const tawkWidgetId = (formData.get("tawkWidgetId") as string) ?? "";
      return updateTracking({ gtmId, tawkPropertyId, tawkWidgetId }, siteId);
    },
    null,
  );
  const [gtmId, setGtmId] = useState(initialGtmId);
  const [tawkPropertyId, setTawkPropertyId] = useState(initialTawkPropertyId);
  const [tawkWidgetId, setTawkWidgetId] = useState(initialTawkWidgetId);
  const dirty =
    gtmId !== initialGtmId ||
    tawkPropertyId !== initialTawkPropertyId ||
    tawkWidgetId !== initialTawkWidgetId;

  function handleSave() {
    const fd = new FormData();
    fd.set("gtmId", gtmId);
    fd.set("tawkPropertyId", tawkPropertyId);
    fd.set("tawkWidgetId", tawkWidgetId);
    formAction(fd);
  }

  // No effect syncing these back from props: the page renders this form with
  // `key={site.id}`, so switching storefront remounts it with fresh initial
  // state. An effect doing the same job by hand is a second, slower copy of the
  // rule — and it is a synchronous setState inside an effect, which is a
  // cascading render the linter is right to flag.

  /**
   * Pasting the embed URL fills both fields on the spot.
   *
   * The server accepts a URL in the property field too — this is only so the
   * admin sees what it resolved to before saving, rather than after.
   */
  function onPropertyChange(value: string) {
    const m = /embed\.tawk\.to\/([0-9a-fA-F]{24})\/([0-9a-zA-Z]{1,30})/.exec(value);
    if (m) {
      setTawkPropertyId(m[1].toLowerCase());
      setTawkWidgetId(m[2].toLowerCase());
      return;
    }
    setTawkPropertyId(value);
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="gtmId" className="mb-1 block text-sm font-medium text-foreground">
          {t("panel.gtmContainerId")}
        </label>
        <input
          id="gtmId"
          name="gtmId"
          value={gtmId}
          onChange={(e) => setGtmId(e.target.value)}
          placeholder="GTM-XXXXXXX"
          autoComplete="off"
          spellCheck={false}
          className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 font-mono text-base sm:text-sm text-foreground placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">{t("panel.gtmEmptyHint")}</p>
      </div>

      <div className="border-t border-[var(--border)] pt-4">
        <h3 className="text-sm font-semibold text-foreground">{t("panel.tawkHeading")}</h3>
        <p className="mb-3 mt-1 text-xs text-[var(--muted)]">{t("panel.tawkIntro")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="tawkPropertyId" className="mb-1 block text-sm font-medium text-foreground">
              {t("panel.tawkPropertyId")}
            </label>
            <input
              id="tawkPropertyId"
              name="tawkPropertyId"
              value={tawkPropertyId}
              onChange={(e) => onPropertyChange(e.target.value)}
              placeholder="https://embed.tawk.to/…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 font-mono text-base sm:text-sm text-foreground placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div className="sm:w-48">
            <label htmlFor="tawkWidgetId" className="mb-1 block text-sm font-medium text-foreground">
              {t("panel.tawkWidgetId")}
            </label>
            <input
              id="tawkWidgetId"
              name="tawkWidgetId"
              value={tawkWidgetId}
              onChange={(e) => setTawkWidgetId(e.target.value)}
              placeholder="Contoh: 1a2b3c4d5"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 font-mono text-base sm:text-sm text-foreground placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">{t("panel.tawkEmptyHint")}</p>
      </div>

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
