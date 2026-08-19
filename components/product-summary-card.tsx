import Link from "next/link";
import type { Light, ProductSummary, Stage } from "@/lib/actions/product-insights";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}sec`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}min ${rem}sec` : `${m}min`;
}

const LIGHT_CLS: Record<Light, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-400",
  gray: "bg-[var(--border)]",
};

const GRADE_CLS: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
  B: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  C: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30",
  D: "bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-orange-500/30",
  F: "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/30",
};

const STAGE_META: Record<Stage, { labelKey: MessageKey; cls: string }> = {
  ignored: { labelKey: "analytics.filterIgnored", cls: "text-[var(--muted)]" },
  "no-interest": { labelKey: "stats.stageNoInterest", cls: "text-rose-600 dark:text-rose-400" },
  "no-conversion": { labelKey: "stats.stageNoConversion", cls: "text-amber-600 dark:text-amber-400" },
  converting: { labelKey: "analytics.conversion", cls: "text-emerald-600 dark:text-emerald-400" },
};

function FunnelLight({ label, level }: { label: string; level: Light }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${LIGHT_CLS[level]}`} aria-hidden />
      <span className="text-xs text-[var(--muted)]">{label}</span>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] text-[var(--muted)]">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[0.625rem] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function EngagementBar({ read, curious, left }: { read: number; curious: number; left: number }) {
  const t = useT();
  const total = read + curious + left || 1;
  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-[var(--background)]"
      title={t("analytics.engagementTitle", { read, curious, left })}
    >
      <div className="bg-emerald-500" style={{ width: `${(read / total) * 100}%` }} />
      <div className="bg-amber-400" style={{ width: `${(curious / total) * 100}%` }} />
      <div className="bg-rose-400" style={{ width: `${(left / total) * 100}%` }} />
    </div>
  );
}

export function ProductSummaryCard({ s, href }: { s: ProductSummary; href?: string }) {
  const t = useT();
  const stage = STAGE_META[s.stage];
  const trendUp = s.trendPct > 0.05;
  const trendDown = s.trendPct < -0.05;

  const title = href ? (
    <Link href={href} className="truncate font-semibold hover:underline">
      {s.title}
    </Link>
  ) : (
    <span className="truncate font-semibold">{s.title}</span>
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">{title}</div>
          <p className={`mt-0.5 text-xs font-medium ${stage.cls}`}>{t(stage.labelKey)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {(trendUp || trendDown) && (
            <span
              className={`text-xs font-medium tabular-nums ${trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
              title={t("stats.trendTitle")}
            >
              {trendUp ? "▲" : "▼"} {Math.abs(Math.round(s.trendPct * 100))}%
            </span>
          )}
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ring-1 ${
              s.grade ? GRADE_CLS[s.grade] : "bg-[var(--background)] text-[var(--muted)] ring-[var(--border)]"
            }`}
            title={t("stats.healthGrade")}
          >
            {s.grade ?? "–"}
          </span>
        </div>
      </div>

      {/* Funnel lights */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-[var(--background)] px-3 py-2">
        <FunnelLight label={t("stats.funnelReach")} level={s.funnel.reach} />
        <span className="text-[var(--border)]">→</span>
        <FunnelLight label={t("stats.funnelInterest")} level={s.funnel.interest} />
        <span className="text-[var(--border)]">→</span>
        <FunnelLight label={t("stats.funnelIntent")} level={s.funnel.intent} />
        <span className="text-[var(--border)]">→</span>
        <FunnelLight label={t("stats.funnelBuy")} level={s.funnel.convert} />
      </div>

      {/* Engagement split */}
      {s.previews > 0 && (
        <div className="space-y-1">
          <EngagementBar read={s.read} curious={s.curious} left={s.left} />
          <div className="flex justify-between text-[0.625rem] text-[var(--muted)]">
            <span className="text-emerald-600 dark:text-emerald-400">Baca {s.read}</span>
            <span className="text-amber-600 dark:text-amber-400">Penasaran {s.curious}</span>
            <span className="text-rose-600 dark:text-rose-400">Pergi {s.left}</span>
          </div>
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        <Stat
          label={t("analytics.previews")}
          value={String(s.previews)}
          hint={t("stats.uniqueCount", { count: s.visitors })}
        />
        <Stat label={t("stats.readRate")} value={`${Math.round(s.readRate * 100)}%`} />
        <Stat label={t("stats.bounce")} value={`${Math.round(s.bounceRate * 100)}%`} />
        <Stat label={t("stats.readMedian")} value={fmtDuration(s.medianDwellMs)} />
        <Stat label={t("stats.toCheckout")} value={`${Math.round(s.toCheckoutRate * 100)}%`} />
        <Stat
          label="CVR"
          value={`${(s.cvr * 100).toFixed(1)}%`}
          hint={t("stats.purchasesCount", { count: s.purchases })}
        />
        <Stat label={t("stats.returning")} value={String(s.repeatViewers)} />
        <Stat label={t("stats.revenue")} value={s.revenue ? rupiah(s.revenue) : "–"} />
      </div>

      {s.bestSource && (
        <p className="text-xs text-[var(--muted)]">
          {t("stats.bestTraffic")}{" "}
          <span className="font-medium text-foreground">{s.bestSource.name}</span>{" "}
          {t("stats.bestTrafficRead", { pct: Math.round(s.bestSource.readRate * 100) })}
        </p>
      )}

      {/* Auto-insights */}
      {s.insights.length > 0 && (
        <ul className="space-y-1 border-t border-[var(--border)] pt-2">
          {s.insights.map((t, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-foreground">
              <span aria-hidden className="text-[var(--primary)]">
                ▸
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
