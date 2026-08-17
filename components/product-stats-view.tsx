"use client";

import { useCallback, useEffect, useState } from "react";
import { getProductStats, type Bucket, type ProductStats } from "@/lib/actions/product-stats";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

const CTA_LABELS: Record<string, MessageKey> = {
  buy: "stats.ctaBuy",
  buy_free: "checkout.getFree",
  buy_link: "product.ctaActionLink",
  calendar: "stats.ctaCalendar",
  share_wa: "stats.ctaShareWa",
  share_threads: "stats.ctaShareThreads",
  share_x: "stats.ctaShareX",
  share_native: "stats.ctaShareOther",
  toc: "stats.ctaToc",
  bookmark: "stats.ctaBookmark",
  add_to_home: "stats.ctaAddToHome",
  login_google: "stats.ctaLoginGoogle",
  like: "stats.ctaLike",
  unlike: "stats.ctaUnlike",
};

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function humanDuration(sec: number) {
  if (sec <= 0) return "0 dtk";  // "dtk"/"m" are unit abbreviations, not copy
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}d` : `${s} dtk`;
}

/** Sub-minute durations, where a tenth of a second is the interesting digit. */
function humanMs(ms: number) {
  if (ms <= 0) return "0 dtk";
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} dtk`;
  return humanDuration(Math.round(ms / 1000));
}

/**
 * Client-side stats view. Renders the aggregated numbers and (when live) polls
 * the getProductStats server action every 5s, updating ONLY the data — no full
 * route re-render, no layout/auth re-run per tick. Polling pauses when the tab
 * is hidden or unfocused, and the user can stop it. One request per tick.
 */
export function ProductStatsView({
  pageId,
  days,
  initial,
  viewCountAllTime,
}: {
  pageId: string;
  days: number;
  initial: ProductStats | null;
  /** Lifetime view counter (same value shown in the product list table). */
  viewCountAllTime: number;
}) {
  const t = useT();
  const [stats, setStats] = useState<ProductStats | null>(initial);
  const [live, setLive] = useState(true);
  // Minutes east of UTC for the viewer's local day (WIB = +420), used to bucket
  // "today"/hourly to their wall clock. Server render defaults to WIB.
  const [tzOffset] = useState(() =>
    typeof window === "undefined" ? 420 : -new Date().getTimezoneOffset(),
  );

  const refetch = useCallback(async () => {
    try {
      const s = await getProductStats(pageId, days, tzOffset);
      if (s) setStats(s);
    } catch {
      /* transient — keep showing the last good data */
    }
  }, [pageId, days, tzOffset]);

  // One refetch shortly after mount so the local timezone (and freshest data) is
  // applied even if the viewer isn't in WIB or has live paused.
  useEffect(() => {
    const t = setTimeout(() => void refetch(), 0);
    return () => clearTimeout(t);
  }, [refetch]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      if (typeof document === "undefined") return;
      if (document.hidden || (document.hasFocus && !document.hasFocus())) return;
      void refetch();
    }, 5000);
    return () => clearInterval(id);
  }, [live, refetch]);

  if (!stats) return <Empty text={t("stats.unavailable")} />;

  const ctaTotal = stats.ctas.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          <strong className="font-medium text-foreground">{t("stats.totalVisits")}</strong>{" "}
          {t("stats.totalVisitsNote", { days: stats.sinceDays })}
        </p>
        <button
          type="button"
          onClick={() => setLive((v) => !v)}
          title={live ? t("stats.pauseLive") : t("stats.resumeLive")}
          aria-pressed={live}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:text-foreground"
        >
          {live ? (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              </span>
              {t("stats.liveEvery5s")}
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
              {t("stats.pausedTapForLive")}
            </>
          )}
        </button>
      </div>

      {/* Top-line numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t("stats.totalVisits")}
          value={fmt(viewCountAllTime)}
          sub={t("stats.allTime")}
        />
        <StatCard
          label={t("stats.visitsInDays", { days: stats.sinceDays })}
          value={fmt(stats.totalViews)}
          sub={t("stats.previewCheckoutSplit", {
            preview: fmt(stats.previewViews),
            checkout: fmt(stats.checkoutViews),
          })}
        />
        <StatCard
          label={t("stats.uniqueSessionsInDays", { days: stats.sinceDays })}
          value={fmt(stats.sessions)}
        />
        <StatCard label={t("stats.avgDuration")} value={humanDuration(stats.avgSessionSec)} />
      </div>

      {/* Reading engagement. Splits "tidak tahu bisa digulir" from "sudah baca
          lalu pergi" — the two need opposite fixes. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <StatCard
          label={t("stats.startedScrolling")}
          value={stats.previewSessions ? `${Math.round(stats.scrollRate * 100)}%` : "—"}
          sub={
            stats.previewSessions
              ? t("stats.scrollOfPreview", {
                  scrolled: fmt(stats.scrollSessions),
                  total: fmt(stats.previewSessions),
                })
              : t("stats.noPreviewSessions")
          }
        />
        <StatCard
          label={t("stats.timeToFirstScroll")}
          value={stats.scrollSessions ? humanMs(stats.medianFirstScrollMs) : "—"}
          sub={stats.scrollSessions ? t("stats.medianSinceText") : t("stats.nobodyScrolled")}
        />
      </div>

      {stats.totalViews === 0 && (
        <Empty text={t("stats.noVisitsInRange")} />
      )}

      <Section title={t("stats.hourlyToday", { total: fmt(stats.todayViews) })}>
        <HourlyChart hourly={stats.hourlyToday} />
      </Section>

      <Section title={t("stats.dailyVisits")}>
        <DailyChart daily={stats.daily} />
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title={t("stats.devices")}>
          <BarList items={stats.devices} total={stats.totalViews} labelMap={{ mobile: "stats.mobile", tablet: "stats.tablet", desktop: "stats.desktop" }} />
        </Section>
        <Section title={t("stats.ctaActions")}>
          <BarList items={stats.ctas} total={ctaTotal} labelMap={CTA_LABELS} />
        </Section>
        <Section title={t("stats.referrers")}>
          <BarList items={stats.referrers} total={stats.totalViews} />
        </Section>
        <Section title="Browser">
          <BarList items={stats.browsers} total={stats.totalViews} />
        </Section>
        <Section title={t("stats.operatingSystem")}>
          <BarList items={stats.os} total={stats.totalViews} />
        </Section>
      </div>

      {stats.capped && (
        <p className="text-xs text-[var(--muted)]">
          {t("stats.capped")}
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-foreground sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted)] shadow-sm">
      {text}
    </div>
  );
}

function BarList({
  items,
  total,
  labelMap,
}: {
  items: Bucket[];
  total: number;
  labelMap?: Record<string, MessageKey>;
}) {
  const t = useT();
  if (items.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{t("stats.noData")}</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((it) => {
        const pct = total > 0 ? Math.round((it.count / total) * 100) : 0;
        return (
          <li key={it.key}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-foreground">
                {(() => {
                  const key = labelMap?.[it.key];
                  return key ? t(key) : it.key;
                })()}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--muted)]">
                {fmt(it.count)}
                {total > 0 && <span className="ml-1.5 text-xs">({pct}%)</span>}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--background)]">
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${Math.max((it.count / max) * 100, 3)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function HourlyChart({ hourly }: { hourly: number[] }) {
  const hours = hourly.length === 24 ? hourly : new Array(24).fill(0);
  const max = Math.max(...hours, 1);
  const nowHour = new Date().getHours();
  return (
    <div>
      <div className="flex h-28 items-end gap-0.5">
        {hours.map((count, h) => (
          <div key={h} className="group relative flex h-full flex-1 items-end">
            <div
              className={`w-full rounded-t transition-colors ${
                h === nowHour ? "bg-[var(--primary)]" : "bg-[var(--primary)]/60 group-hover:bg-[var(--primary)]"
              }`}
              style={{ height: `${Math.max((count / max) * 100, count > 0 ? 6 : 2)}%` }}
              title={`${String(h).padStart(2, "0")}:00 — ${count}`}
            />
          </div>
        ))}
      </div>
      {/* Sparse hour axis: 00, 06, 12, 18, 23 */}
      <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
        {["00", "06", "12", "18", "23"].map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function DailyChart({ daily }: { daily: { date: string; views: number }[] }) {
  const max = Math.max(...daily.map((d) => d.views), 1);
  return (
    <div className="flex h-28 items-end gap-0.5">
      {daily.map((d) => (
        <div key={d.date} className="group relative flex h-full flex-1 items-end">
          <div
            className="w-full rounded-t bg-[var(--primary)]/70 transition-colors group-hover:bg-[var(--primary)]"
            style={{ height: `${Math.max((d.views / max) * 100, d.views > 0 ? 6 : 2)}%` }}
            title={`${d.date}: ${d.views}`}
          />
        </div>
      ))}
    </div>
  );
}
