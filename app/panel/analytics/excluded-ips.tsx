"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  addExcludedIp,
  removeExcludedIp,
  purgeExcludedIp,
  type ExcludedIp,
} from "@/lib/actions/excluded-ips";
import { useT } from "@/lib/i18n/client";

/**
 * Manage which addresses are kept out of the analytics. The per-user flag only
 * works for signed-in visitors, so this is what catches the owner's own
 * logged-out browsing.
 *
 * Rendered as a button that opens a popup, not a panel on the page. This list is
 * set once and then forgotten for months, so any room it takes above the charts
 * is room the numbers don't get — even collapsed to a single bar it was pushing
 * the thing people actually came for further down. The button sits inline with
 * the range picker and costs no vertical space at all; the count rides on it so
 * the state is still legible without opening anything.
 */
export function ExcludedIps({ initial, myIp }: { initial: ExcludedIp[]; myIp: string | null }) {
  const t = useT();
  const [rows, setRows] = useState<ExcludedIp[]>(initial);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-foreground"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m0 0L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636"
          />
        </svg>
        {t("analytics.excludedIps")}
        <span className="rounded bg-[var(--background)] px-1.5 py-0.5 tabular-nums">
          {rows.length}
        </span>
      </button>

      {open && (
        <ExcludedIpsDialog
          rows={rows}
          setRows={setRows}
          myIp={myIp}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Split out so every piece of editing state is created on open and thrown away
 * on close — a half-typed address left over from last time would be a small
 * trap, since the button next to it deletes sessions.
 */
function ExcludedIpsDialog({
  rows,
  setRows,
  myIp,
  onClose,
}: {
  rows: ExcludedIp[];
  setRows: React.Dispatch<React.SetStateAction<ExcludedIp[]>>;
  myIp: string | null;
  onClose: () => void;
}) {
  const t = useT();
  const [ip, setIp] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const alreadyMine = !!myIp && rows.some((r) => r.ip === myIp);

  // Esc to close + lock background scroll while open (same as AssetLibraryModal).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function add(value: string, label?: string) {
    const v = value.trim();
    if (!v) return;
    start(async () => {
      const res = await addExcludedIp(v, label);
      if (!res.ok) {
        setMsg(res.error ?? t("common.failedShort"));
        return;
      }
      setRows((prev) => [
        { ip: v, note: label?.trim() || null, created_at: new Date().toISOString(), sessions: 0 },
        ...prev.filter((r) => r.ip !== v),
      ]);
      setIp("");
      setNote("");
      setMsg(
        res.purged
          ? t("analytics.ipExcludedPurged", { ip: v, count: res.purged })
          : t("analytics.ipExcluded", { ip: v }),
      );
    });
  }

  function remove(value: string) {
    start(async () => {
      const res = await removeExcludedIp(value);
      if (!res.ok) {
        setMsg(res.error ?? t("common.failedShort"));
        return;
      }
      setRows((prev) => prev.filter((r) => r.ip !== value));
      setMsg(t("analytics.ipCountedAgain", { ip: value }));
    });
  }

  function purge(value: string) {
    start(async () => {
      const res = await purgeExcludedIp(value);
      setRows((prev) => prev.map((r) => (r.ip === value ? { ...r, sessions: 0 } : r)));
      setMsg(
        res.purged
          ? t("analytics.ipPurged", { count: res.purged, ip: value })
          : t("analytics.ipNoSessions"),
      );
    });
  }

  // No mounted guard: this only ever renders after a click, so it is never part
  // of the server render and document.body is always there.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("analytics.excludedIps")}
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("analytics.excludedIps")}</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {t("analytics.excludedIntroBefore")}{" "}
              <strong className="text-foreground">{t("analytics.excludedIntroBold")}</strong>
              {t("analytics.excludedIntroAfter")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="-mr-1.5 -mt-1.5 rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          {myIp && !alreadyMine && (
            <button
              type="button"
              onClick={() => add(myIp, t("analytics.myIpNote"))}
              disabled={pending}
              className="w-full rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {t("analytics.excludeMyIp", { ip: myIp })}
            </button>
          )}
          {myIp && alreadyMine && (
            <p className="text-xs text-[var(--muted)]">
              {t("analytics.myIpBefore")} <code className="font-mono">{myIp}</code>{" "}
              {t("analytics.myIpAfter")}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder={t("analytics.ipPlaceholder")}
              className="min-w-[10rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("analytics.noteOptional")}
              className="min-w-[8rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            />
            <button
              type="button"
              onClick={() => add(ip, note)}
              disabled={pending || !ip.trim()}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[var(--background)] disabled:opacity-50"
            >
              {t("common.add")}
            </button>
          </div>

          {msg && <p className="text-xs text-[var(--primary)]">{msg}</p>}

          {rows.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">{t("analytics.noExcludedIps")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <li key={r.ip} className="flex flex-wrap items-center gap-2 py-2">
                  <code className="font-mono text-xs text-foreground">{r.ip}</code>
                  {r.note && <span className="text-xs text-[var(--muted)]">· {r.note}</span>}
                  {r.sessions > 0 && (
                    <button
                      type="button"
                      onClick={() => purge(r.ip)}
                      disabled={pending}
                      className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-500/25 disabled:opacity-50 dark:text-amber-400"
                      title={t("analytics.staleSession")}
                    >
                      {t("analytics.staleSessionCount", { count: r.sessions })}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(r.ip)}
                    disabled={pending}
                    className="ml-auto text-xs font-medium text-[var(--muted)] transition-colors hover:text-red-600 disabled:opacity-50"
                  >
                    {t("common.delete")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
