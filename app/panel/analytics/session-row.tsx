"use client";

import { Fragment, useState } from "react";
import { getSessionJourney, type JourneyStep, type SessionListRow } from "@/lib/actions/analytics";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

const ENGAGEMENT_LABEL: Record<string, { labelKey: MessageKey; cls: string }> = {
  read: { labelKey: "analytics.read", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  curious: { labelKey: "analytics.curious", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  left: { labelKey: "analytics.left", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
};

const PAGE_LABEL: Record<string, MessageKey> = {
  home: "nav.home",
  preview: "checkout.preview",
  checkout: "product.ctaLabelCheckout",
  panel: "analytics.pagePanel",
  other: "home.otherLinks",
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
  const t = useT();
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
            <span className="whitespace-nowrap text-xs text-[var(--muted)]">
              {fmtTime(s.startedAt)}
            </span>
          </div>
        </td>
        <td className="px-3 py-2">
          {s.email || s.name || <span className="text-[var(--muted)]">Anonim</span>}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{fmtDuration(s.durationMs)}</td>
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
        <td className="px-3 py-2 text-right tabular-nums">{s.pageviews}</td>
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
            {loading && <p className="text-xs text-[var(--muted)]">{t("analytics.loadingJourney")}</p>}
            {steps && steps.length === 0 && (
              <p className="text-xs text-[var(--muted)]">{t("analytics.noSteps")}</p>
            )}
            {steps && steps.length > 0 && (
              <ol className="space-y-1.5">
                {steps.map((st, i) => {
                  const eng = st.engagement ? ENGAGEMENT_LABEL[st.engagement] : null;
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="w-5 shrink-0 text-right tabular-nums text-[var(--muted)]">{i + 1}.</span>
                      <span className="rounded bg-[var(--card)] px-1.5 py-0.5 text-[var(--muted)]">
                        {(() => {
                          const key = PAGE_LABEL[st.pageType ?? "other"];
                          return key ? t(key) : st.pageType;
                        })()}
                      </span>
                      <span className="font-medium">{st.title || st.path}</span>
                      <span className="text-[var(--muted)]">{fmtDuration(st.dwellMs)}</span>
                      {st.scrollDepth !== null && (
                        <span className="text-[var(--muted)]">scroll {st.scrollDepth}%</span>
                      )}
                      {eng && (
                        <span className={`rounded px-1.5 py-0.5 font-medium ${eng.cls}`}>{t(eng.labelKey)}</span>
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
