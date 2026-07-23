import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { canSellProducts } from "@/lib/actions/profiles";
import { getLandingPageById } from "@/lib/actions/landing-pages";
import { getProductStats, type Bucket } from "@/lib/actions/product-stats";
import { LiveRefreshToggle } from "@/components/live-refresh-toggle";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
};

const RANGES = [7, 30, 90];

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

export default async function ProductStatsPage({ params, searchParams }: Props) {
  const canSell = await canSellProducts();
  if (!canSell) redirect("/panel");

  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;

  const [page, stats] = await Promise.all([getLandingPageById(id), getProductStats(id, days)]);
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Link href="/panel/products" className="text-sm text-[var(--muted)] transition-colors hover:text-foreground">
            ← Kembali
          </Link>
          <h1 className="truncate text-xl font-semibold tracking-tight">Statistik — {page.title}</h1>
          {/* Pausable live refresh (was flooding with a fixed 5s poll before). */}
          <LiveRefreshToggle intervalMs={5000} />
        </div>
        {/* Range selector */}
        <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--background)] p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/panel/product/${id}/stats?days=${r}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                days === r
                  ? "bg-[var(--card)] text-foreground shadow-sm ring-1 ring-[var(--border)]"
                  : "text-[var(--muted)] hover:text-foreground"
              }`}
            >
              {r} hari
            </Link>
          ))}
        </div>
      </div>

      {!stats ? (
        <Empty text="Statistik tidak tersedia." />
      ) : (
        <>
          {/* Top-line numbers */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Kunjungan" value={fmt(stats.totalViews)} />
            <StatCard label="Sesi unik" value={fmt(stats.sessions)} />
            <StatCard label="Rata-rata durasi" value={humanDuration(stats.avgSessionSec)} />
            <StatCard
              label="Preview / Checkout"
              value={`${fmt(stats.previewViews)} / ${fmt(stats.checkoutViews)}`}
            />
          </div>

          {stats.totalViews === 0 && (
            <Empty text="Belum ada kunjungan pada rentang ini. Data mulai terkumpul saat pengunjung membuka halaman preview / checkout produk." />
          )}

          {/* Daily views chart */}
          <Section title="Kunjungan per hari">
            <DailyChart daily={stats.daily} />
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Perangkat">
              <BarList items={stats.devices} total={stats.totalViews} labelMap={{ mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" }} />
            </Section>
            <Section title="Aksi CTA">
              <BarList items={stats.ctas} total={stats.ctas.reduce((a, b) => a + b.count, 0)} labelMap={CTA_LABELS} />
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
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-foreground sm:text-2xl">{value}</p>
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
