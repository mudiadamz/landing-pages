"use client";

import { useState } from "react";
import type { Analytics, SessionListRow } from "@/lib/actions/analytics";
import type { ProductSummary } from "@/lib/actions/product-insights";
import { ProductSummaryCard } from "@/components/product-summary-card";
import { SessionRow } from "./session-row";

type Tab = "overview" | "products" | "acquisition" | "geography" | "entry" | "engagement" | "sessions";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Ringkasan" },
  { key: "products", label: "Produk" },
  { key: "acquisition", label: "Akuisisi / Iklan" },
  { key: "engagement", label: "Engagement Preview" },
  { key: "entry", label: "Entry Point" },
  { key: "geography", label: "Geografi" },
  { key: "sessions", label: "Sesi" },
];

type ProductFilter = "all" | "attention" | "converting" | "ignored";

const PRODUCT_FILTERS: { key: ProductFilter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "attention", label: "Perlu perhatian" },
  { key: "converting", label: "Konversi" },
  { key: "ignored", label: "Diabaikan" },
];

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}sec`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}min ${rem}sec` : `${m}min`;
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-medium text-[var(--muted)] ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

type SortKey = "duration" | "pageviews" | "time";

function SortTh({
  label,
  col,
  sort,
  onSort,
  right,
}: {
  label: string;
  col: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = sort.key === col;
  return (
    <th className={`px-3 py-2 text-xs font-medium ${right ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
          active ? "text-foreground" : "text-[var(--muted)]"
        }`}
      >
        {label}
        <span aria-hidden className={active ? "" : "opacity-30"}>
          {active ? (sort.dir === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
  );
}

function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return (
    <td className={`px-3 py-2 ${right ? "text-right tabular-nums" : ""} ${mono ? "font-mono text-xs" : ""}`}>
      {children}
    </td>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <table className="w-full min-w-[560px] text-sm">{children}</table>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">{children}</p>;
}

function EngagementBar({ read, curious, left }: { read: number; curious: number; left: number }) {
  const total = read + curious + left || 1;
  return (
    <div className="flex h-2.5 w-28 overflow-hidden rounded-full bg-[var(--background)]" title={`Baca ${read} · Penasaran ${curious} · Pergi ${left}`}>
      <div className="bg-emerald-500" style={{ width: `${(read / total) * 100}%` }} />
      <div className="bg-amber-400" style={{ width: `${(curious / total) * 100}%` }} />
      <div className="bg-rose-400" style={{ width: `${(left / total) * 100}%` }} />
    </div>
  );
}

export function AnalyticsDashboard({ data, products }: { data: Analytics; products: ProductSummary[] }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [q, setQ] = useState("");
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "time", dir: "desc" });

  const sortBy = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  if (!data.ok) return <Empty>Tidak ada akses atau data gagal dimuat.</Empty>;

  const { overview, campaigns, referrers, geography, entryPoints, engagement, sessions } = data;

  const filteredProducts = products.filter((p) => {
    if (productFilter === "attention") return p.previews > 0 && p.stage !== "converting";
    if (productFilter === "converting") return p.stage === "converting";
    if (productFilter === "ignored") return p.previews === 0;
    return true;
  });

  const filtered = q.trim()
    ? sessions.filter((s) => matchSession(s, q.trim().toLowerCase()))
    : sessions;
  const filteredSessions = [...filtered].sort((a, b) => {
    const d = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "duration") return (a.durationMs - b.durationMs) * d;
    if (sort.key === "pageviews") return (a.pageviews - b.pageviews) * d;
    return (new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()) * d;
  });

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted)] hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card label="Sesi" value={String(overview.sessions)} />
          <Card label="Pengunjung unik" value={String(overview.visitors)} />
          <Card label="Login" value={String(overview.loggedIn)} sub={`${overview.anon} anonim`} />
          <Card label="Pageview" value={String(overview.pageviews)} />
          <Card label="Durasi rata²" value={fmtDuration(overview.avgDurationMs)} />
          <Card
            label="Pageview / sesi"
            value={overview.sessions ? (overview.pageviews / overview.sessions).toFixed(1) : "0"}
          />
        </div>
      )}

      {tab === "products" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--muted)]">
              Ringkasan perilaku per produk: apakah dapat perhatian, dibaca, dan berkonversi. Diurutkan dari
              trafik terbanyak.
            </p>
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
              {PRODUCT_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setProductFilter(f.key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    productFilter === f.key
                      ? "bg-[var(--accent-subtle)] text-[var(--primary)]"
                      : "text-[var(--muted)] hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {filteredProducts.length === 0 ? (
            <Empty>Tidak ada produk pada filter ini.</Empty>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {filteredProducts.map((p) => (
                <ProductSummaryCard
                  key={p.slug}
                  s={p}
                  href={p.id ? `/panel/product/${p.id}/stats` : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "acquisition" && (
        <div className="space-y-5">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Kampanye (UTM)</h2>
            {campaigns.length === 0 ? (
              <Empty>Belum ada trafik ber-UTM. Tambahkan <code>?utm_source=…&amp;utm_campaign=…</code> ke link iklan.</Empty>
            ) : (
              <TableShell>
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Campaign</Th>
                    <Th>Source</Th>
                    <Th>Medium</Th>
                    <Th right>Sesi</Th>
                    <Th right>Preview</Th>
                    <Th right>Checkout</Th>
                    <Th right>Konversi</Th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.key} className="border-b border-[var(--border)] last:border-0">
                      <Td>{c.campaign || "—"}</Td>
                      <Td>{c.source || "—"}</Td>
                      <Td>{c.medium || "—"}</Td>
                      <Td right>{c.sessions}</Td>
                      <Td right>{c.previews}</Td>
                      <Td right>{c.checkouts}</Td>
                      <Td right>{(c.convRate * 100).toFixed(0)}%</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Referrer</h2>
            {referrers.length === 0 ? (
              <Empty>Belum ada referrer eksternal.</Empty>
            ) : (
              <TableShell>
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Host</Th>
                    <Th right>Sesi</Th>
                    <Th right>Checkout</Th>
                  </tr>
                </thead>
                <tbody>
                  {referrers.map((r) => (
                    <tr key={r.host} className="border-b border-[var(--border)] last:border-0">
                      <Td mono>{r.host}</Td>
                      <Td right>{r.sessions}</Td>
                      <Td right>{r.checkouts}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </div>
        </div>
      )}

      {tab === "engagement" && (
        <div>
          <p className="mb-2 text-xs text-[var(--muted)]">
            Per produk: berapa yang <span className="text-emerald-600 dark:text-emerald-400">membaca</span>,{" "}
            <span className="text-amber-600 dark:text-amber-400">penasaran</span>, atau{" "}
            <span className="text-rose-600 dark:text-rose-400">langsung pergi</span> di halaman preview
            (dari lama-baca &amp; kedalaman scroll).
          </p>
          {engagement.length === 0 ? (
            <Empty>Belum ada kunjungan preview.</Empty>
          ) : (
            <TableShell>
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <Th>Produk</Th>
                  <Th>Sebaran</Th>
                  <Th right>Baca</Th>
                  <Th right>Penasaran</Th>
                  <Th right>Pergi</Th>
                  <Th right>Total</Th>
                  <Th right>Avg baca</Th>
                  <Th right>Avg scroll</Th>
                </tr>
              </thead>
              <tbody>
                {engagement.map((e) => (
                  <tr key={e.slug} className="border-b border-[var(--border)] last:border-0">
                    <Td>{e.title || e.slug}</Td>
                    <Td>
                      <EngagementBar read={e.read} curious={e.curious} left={e.left} />
                    </Td>
                    <Td right>{e.read}</Td>
                    <Td right>{e.curious}</Td>
                    <Td right>{e.left}</Td>
                    <Td right>{e.total}</Td>
                    <Td right>{fmtDuration(e.avgDwellMs)}</Td>
                    <Td right>{e.avgScroll}%</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </div>
      )}

      {tab === "entry" && (
        <div>
          {entryPoints.length === 0 ? (
            <Empty>Belum ada data entry point.</Empty>
          ) : (
            <TableShell>
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <Th>Halaman masuk</Th>
                  <Th>Produk</Th>
                  <Th right>Sesi</Th>
                </tr>
              </thead>
              <tbody>
                {entryPoints.map((e) => (
                  <tr key={e.path} className="border-b border-[var(--border)] last:border-0">
                    <Td mono>{e.path}</Td>
                    <Td>{e.title || "—"}</Td>
                    <Td right>{e.sessions}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </div>
      )}

      {tab === "geography" && (
        <div>
          {geography.length === 0 ? (
            <Empty>Belum ada data geografi (IP lokal / privat dilewati).</Empty>
          ) : (
            <TableShell>
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <Th>Negara</Th>
                  <Th>Kota</Th>
                  <Th right>Sesi</Th>
                </tr>
              </thead>
              <tbody>
                {geography.map((g) => (
                  <tr key={`${g.country}|${g.city}`} className="border-b border-[var(--border)] last:border-0">
                    <Td>{g.country}</Td>
                    <Td>{g.city || "—"}</Td>
                    <Td right>{g.sessions}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </div>
      )}

      {tab === "sessions" && (
        <div className="space-y-3">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari email, IP, kota, campaign, produk…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
          {filteredSessions.length === 0 ? (
            <Empty>Tidak ada sesi.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <SortTh label="Waktu" col="time" sort={sort} onSort={sortBy} />
                    <Th>Pengunjung</Th>
                    <SortTh right label="Durasi" col="duration" sort={sort} onSort={sortBy} />
                    <Th>Lokasi</Th>
                    <Th>Sumber</Th>
                    <Th>Masuk via</Th>
                    <Th>Perangkat</Th>
                    <SortTh right label="Hal." col="pageviews" sort={sort} onSort={sortBy} />
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.slice(0, 300).map((s) => (
                    <SessionRow key={s.sessionId} s={s} fmtDuration={fmtDuration} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredSessions.length > 300 && (
            <p className="text-center text-xs text-[var(--muted)]">
              Menampilkan 300 dari {filteredSessions.length} sesi. Persempit dengan pencarian.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function matchSession(s: SessionListRow, q: string): boolean {
  return [
    s.email,
    s.name,
    s.ip,
    s.country,
    s.city,
    s.isp,
    s.campaign,
    s.source,
    s.referrerHost,
    s.entryTitle,
    s.landingPath,
    s.device,
    s.browser,
  ]
    .filter(Boolean)
    .some((v) => (v as string).toLowerCase().includes(q));
}
