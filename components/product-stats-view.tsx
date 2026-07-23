"use client";

import { useCallback, useEffect, useState } from "react";
import { getProductStats, type Bucket, type ProductStats } from "@/lib/actions/product-stats";

const CTA_LABELS: Record<string, string> = {
  buy: "Beli / checkout",
  buy_free: "Ambil gratis",
  buy_link: "Link eksternal",
  calendar: "Tambah ke kalender",
  share_wa: "Share — WhatsApp",
  share_threads: "Share — Threads",
  share_x: "Share — X",
  share_native: "Share — lainnya",
  bookmark: "Simpan (bookmark)",
  add_to_home: "Tambah ke layar utama",
};

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function humanDuration(sec: number) {
  if (sec <= 0) return "0 dtk";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}d` : `${s} dtk`;
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

  if (!stats) return <Empty text="Statistik tidak tersedia." />;

  const ctaTotal = stats.ctas.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          <strong className="font-medium text-foreground">Total kunjungan</strong> = semua waktu
          (sama seperti kolom di daftar produk). Metrik lain di bawah mencakup{" "}
          {stats.sinceDays} hari terakhir, sejak fitur analitik aktif.
        </p>
        <button
          type="button"
          onClick={() => setLive((v) => !v)}
          title={live ? "Jeda pembaruan otomatis" : "Aktifkan pembaruan otomatis"}
          aria-pressed={live}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:text-foreground"
        >
          {live ? (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              </span>
              Live · tiap 5 dtk
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
              Jeda — ketuk untuk live
            </>
          )}
        </button>
      </div>

      {/* Top-line numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total kunjungan" value={fmt(viewCountAllTime)} sub="semua waktu" />
        <StatCard
          label={`Kunjungan · ${stats.sinceDays} hari`}
          value={fmt(stats.totalViews)}
          sub={`preview ${fmt(stats.previewViews)} · checkout ${fmt(stats.checkoutViews)}`}
        />
        <StatCard label={`Sesi unik · ${stats.sinceDays} hari`} value={fmt(stats.sessions)} />
        <StatCard label="Durasi rata-rata" value={humanDuration(stats.avgSessionSec)} />
      </div>

      {stats.totalViews === 0 && (
        <Empty text="Belum ada kunjungan pada rentang ini. Data mulai terkumpul saat pengunjung membuka halaman preview / checkout produk." />
      )}

      <Section title={`Kunjungan per jam hari ini · ${fmt(stats.todayViews)} total`}>
        <HourlyChart hourly={stats.hourlyToday} />
      </Section>

      <Section title="Kunjungan per hari">
        <DailyChart daily={stats.daily} />
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Perangkat">
          <BarList items={stats.devices} total={stats.totalViews} labelMap={{ mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" }} />
        </Section>
        <Section title="Aksi CTA">
          <BarList items={stats.ctas} total={ctaTotal} labelMap={CTA_LABELS} />
        </Section>
        <Section title="Sumber (referrer)">
          <BarList items={stats.referrers} total={stats.totalViews} />
        </Section>
        <Section title="Browser">
          <BarList items={stats.browsers} total={stats.totalViews} />
        </Section>
        <Section title="Sistem operasi">
          <BarList items={stats.os} total={stats.totalViews} />
        </Section>
      </div>

      {stats.capped && (
        <p className="text-xs text-[var(--muted)]">
          Menampilkan sebagian data (dibatasi demi performa). Perkecil rentang untuk angka yang lebih akurat.
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
  labelMap?: Record<string, string>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Belum ada data.</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((it) => {
        const pct = total > 0 ? Math.round((it.count / total) * 100) : 0;
        return (
          <li key={it.key}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-foreground">{labelMap?.[it.key] ?? it.key}</span>
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
