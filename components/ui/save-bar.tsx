"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * One sticky save bar for the whole panel. The audit found four different save
 * patterns and no warning about unsaved edits — including on forms 2,000–5,500px
 * tall where the button scrolled off. This bar sticks to the bottom, shows an
 * "unsaved changes" hint the moment the form is dirty, disables Save when there
 * is nothing to save, and blocks a full-page unload while dirty (reload, tab
 * close, external link).
 *
 * Client-side <Link> navigation is not intercepted — the App Router has no stable
 * block API — so the visible dirty hint is the guard there.
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  saveLabel,
  savingLabel,
  unsavedLabel,
  saved = false,
  savedLabel,
  error,
  onReset,
  resetLabel,
  extra,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  saveLabel: string;
  savingLabel: string;
  /** "Ada perubahan belum disimpan" — shown while dirty. */
  unsavedLabel: string;
  saved?: boolean;
  savedLabel?: string;
  error?: string | null;
  onReset?: () => void;
  resetLabel?: string;
  /** Trailing content, e.g. a "view homepage" link. Sits on the right. */
  extra?: ReactNode;
}) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--background)]/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80">
      <Button size="md" onClick={onSave} loading={saving} disabled={saving || !dirty}>
        {saving ? savingLabel : saveLabel}
      </Button>

      {dirty && !saving && (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
          {unsavedLabel}
        </span>
      )}

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="min-h-[36px] rounded-lg px-2 text-sm text-[var(--muted)] transition-colors hover:text-foreground"
        >
          {resetLabel}
        </button>
      )}

      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      {saved && !dirty && (
        <span className="text-sm text-green-600 dark:text-green-400">{savedLabel}</span>
      )}

      {extra && <div className="ml-auto flex items-center gap-3">{extra}</div>}
    </div>
  );
}
