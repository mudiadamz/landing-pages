"use client";

import { Fragment, useState } from "react";
import { getSessionJourney, type JourneyStep, type SessionListRow } from "@/lib/actions/analytics";

const ENGAGEMENT_LABEL: Record<string, { label: string; cls: string }> = {
  read: { label: "Baca", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  curious: { label: "Penasaran", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  left: { label: "Pergi", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
};

const PAGE_LABEL: Record<string, string> = {
  home: "Beranda",
  preview: "Preview",
  checkout: "Checkout",
  panel: "Panel",
  other: "Lainnya",
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SessionRow({
  s,
  fmtDuration,
}: {
  s: SessionListRow;
  fmtDuration: (ms: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<JourneyStep[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && steps === null && !loading) {
      setLoading(true);
      try {
        setSteps(await getSessionJourney(s.sessionId));
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <Fragment>
      <tr
        className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]"
        onClick={toggle}
      >
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className={`transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
              ›
            </span>
            <span>
              {s.email || s.name || (
                <span className="text-[var(--muted)]">Anonim</span>
              )}
            </span>
          </div>
        </td>
        <td className="px-3 py-2">
          <span className="text-xs">
            {[s.city, s.country].filter(Boolean).join(", ") || "—"}
            {s.ip && <span className="ml-1 font-mono text-[var(--muted)]">{s.ip}</span>}
          </span>
        </td>
        <td className="px-3 py-2 text-xs">
          {s.campaign || s.source || s.referrerHost || "Langsung"}
        </td>
        <td className="px-3 py-2 text-xs">{s.entryTitle || s.landingPath || "—"}</td>
        <td className="px-3 py-2 text-xs">
          {[s.device, s.browser].filter(Boolean).join(" · ") || "—"}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{fmtDuration(s.durationMs)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{s.pageviews}</td>
        <td className="px-3 py-2 text-xs text-[var(--muted)]">{fmtTime(s.startedAt)}</td>
      </tr>
      {open && (
        <tr className="border-b border-[var(--border)] last:border-0 bg-[var(--background)]">
          <td colSpan={8} className="px-3 py-3">
            {s.isp && (
              <p className="mb-2 text-xs text-[var(--muted)]">
                ISP: {s.isp}
                {s.source && ` · utm_source=${s.source}`}
                {s.campaign && ` · utm_campaign=${s.campaign}`}
              </p>
            )}
            {loading && <p className="text-xs text-[var(--muted)]">Memuat perjalanan…</p>}
            {steps && steps.length === 0 && (
              <p className="text-xs text-[var(--muted)]">Tidak ada langkah tercatat.</p>
            )}
            {steps && steps.length > 0 && (
              <ol className="space-y-1.5">
                {steps.map((st, i) => {
                  const eng = st.engagement ? ENGAGEMENT_LABEL[st.engagement] : null;
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="w-5 shrink-0 text-right tabular-nums text-[var(--muted)]">{i + 1}.</span>
                      <span className="rounded bg-[var(--card)] px-1.5 py-0.5 text-[var(--muted)]">
                        {PAGE_LABEL[st.pageType ?? "other"] ?? st.pageType}
                      </span>
                      <span className="font-medium">{st.title || st.path}</span>
                      <span className="text-[var(--muted)]">{fmtDuration(st.dwellMs)}</span>
                      <span className="text-[var(--muted)]">scroll {st.scrollDepth}%</span>
                      {eng && (
                        <span className={`rounded px-1.5 py-0.5 font-medium ${eng.cls}`}>{eng.label}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
