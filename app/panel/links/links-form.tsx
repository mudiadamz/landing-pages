"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateOtherLinks, type OtherLink } from "@/lib/actions/site-settings";
import { t } from "@/lib/i18n";

const EMPTY: OtherLink = { label: "", url: "", note: "" };

/**
 * The list of other places this storefront's owner exists on the internet,
 * shown behind the link icon on the homepage.
 *
 * A plain repeating row rather than a table: there are at most twenty of these,
 * each is three short fields, and a table on a phone would be the horizontal
 * scroll this panel spent a session getting rid of.
 */
export function LinksForm({ initial }: { initial: OtherLink[] }) {
  const [rows, setRows] = useState<OtherLink[]>(initial.length ? initial : [EMPTY]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = (i: number, next: Partial<OtherLink>) => {
    setRows((r) => r.map((row, k) => (k === i ? { ...row, ...next } : row)));
    setStatus(null);
  };

  const remove = (i: number) => {
    setRows((r) => (r.length === 1 ? [EMPTY] : r.filter((_, k) => k !== i)));
    setStatus(null);
  };

  // Order is what the visitor sees, so it has to be editable — and two buttons
  // are a far smaller thing to get right than drag-and-drop on a touch screen.
  const move = (i: number, dir: -1 | 1) => {
    setRows((r) => {
      const to = i + dir;
      if (to < 0 || to >= r.length) return r;
      const copy = [...r];
      [copy[i], copy[to]] = [copy[to], copy[i]];
      return copy;
    });
    setStatus(null);
  };

  async function save() {
    setSaving(true);
    setError(null);
    setStatus(null);
    const res = await updateOtherLinks(rows);
    setSaving(false);
    if (res.ok) {
      setStatus(t("common.saved"));
      // Dropped rows (no label, no URL, or a non-http link) never reach the
      // page — show that here rather than letting the form claim they saved.
      setRows((r) =>
        r.filter((x) => x.label.trim() && /^https?:\/\//i.test(x.url.trim())).length
          ? r
          : [EMPTY],
      );
    } else {
      setError(res.error ?? t("common.failed"));
    }
  }

  const input =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--background)]/40 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--muted)]">Link {i + 1}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={t("panel.moveUp")}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-foreground disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                aria-label={t("panel.moveDown")}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-foreground disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={t("panel.removeLink")}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
              >
                ×
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className={input}
              value={row.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              placeholder={t("panel.linkName")}
              maxLength={80}
            />
            <input
              className={input}
              value={row.url}
              onChange={(e) => patch(i, { url: e.target.value })}
              placeholder="https://…"
              inputMode="url"
              maxLength={500}
            />
          </div>
          <input
            className={`${input} mt-2`}
            value={row.note}
            onChange={(e) => patch(i, { note: e.target.value })}
            placeholder={t("panel.linkNote")}
            maxLength={120}
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => setRows((r) => [...r, EMPTY])}
          disabled={rows.length >= 20}
        >
          {t("panel.addLink")}
        </Button>
        <Button type="button" size="md" onClick={save} disabled={saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
        {status && <span className="text-sm text-green-600 dark:text-green-400">{status}</span>}
        {error && <span className="text-sm text-red-500 dark:text-red-400">{error}</span>}
      </div>

      <p className="text-xs text-[var(--muted)]">
        Hanya link <span className="font-mono">http://</span> atau{" "}
        <span className="font-mono">https://</span> yang disimpan. Baris tanpa nama atau
        tanpa URL diabaikan.
      </p>
    </div>
  );
}
