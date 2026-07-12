import { redirect } from "next/navigation";
import { requireFeature, getProfile } from "@/lib/actions/profiles";
import { getStats, getCustomers, getMyProductStats, type Stats, type CustomerRow, type PublisherStats } from "@/lib/actions/admin";

export default async function StatsPage() {
  // Admins / users granted the "stats" feature see global stats; publishers see
  // stats for their own products only.
  const [profile, hasGlobal] = await Promise.all([getProfile(), requireFeature("stats")]);
  const isPublisher = profile?.role === "publisher";
  if (!hasGlobal && !isPublisher) redirect("/panel");

  if (hasGlobal) {
    const [stats, customers] = await Promise.all([getStats(), getCustomers()]);
    if (!stats) return null;
    return <GlobalStats stats={stats} customers={customers} />;
  }

  const stats = await getMyProductStats();
  if (!stats) return null;
  return <MyProductStats stats={stats} />;
}

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm min-w-0">
      <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl sm:text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function MyProductStats({ stats }: { stats: PublisherStats }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Stats</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Ringkasan penjualan dari produk Anda.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Produk saya" value={stats.totalProducts} />
        <StatCard label="Terjual" value={stats.totalSales} />
        <StatCard label="Pendapatan" value={formatIDR(stats.totalRevenue)} />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Per produk</h2>
        {stats.products.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
            <p className="text-sm text-[var(--muted)]">Belum ada produk.</p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden space-y-3">
              {stats.products.map((p) => (
                <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                  <p className="font-medium text-foreground">{p.title || "—"}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {p.sold} terjual · {formatIDR(p.revenue)}
                  </p>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                      <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Produk</th>
                      <th className="px-4 py-3.5 text-right text-sm font-medium text-foreground">Terjual</th>
                      <th className="px-4 py-3.5 text-right text-sm font-medium text-foreground">Pendapatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.products.map((p) => (
                      <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-foreground">{p.title || "—"}</td>
                        <td className="px-4 py-3.5 text-right text-sm text-foreground">{p.sold}</td>
                        <td className="px-4 py-3.5 text-right text-sm text-[var(--muted)]">{formatIDR(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GlobalStats({ stats, customers }: { stats: Stats; customers: CustomerRow[] }) {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Stats</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Landing pages" value={stats.totalLandingPages} />
        <StatCard label="Total purchases" value={stats.totalPurchases} />
        <StatCard label="Customers" value={stats.totalCustomers} />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Daftar pelanggan</h2>
        {customers.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
            <p className="text-sm text-[var(--muted)]">Belum ada pelanggan</p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden space-y-3">
              {customers.map((c) => (
                <div key={c.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                  <p className="font-medium text-foreground">{c.full_name || "—"}</p>
                  <p className="mt-0.5 text-sm text-[var(--muted)] break-all">{c.email || "—"}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {c.purchase_count} pembelian · Terakhir: {formatDate(c.last_purchase_at)}
                  </p>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                      <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Nama</th>
                      <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Email</th>
                      <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Pembelian</th>
                      <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Pembelian terakhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-foreground">{c.full_name || "—"}</td>
                        <td className="px-4 py-3.5 text-sm text-[var(--muted)]">{c.email || "—"}</td>
                        <td className="px-4 py-3.5 text-sm text-foreground">{c.purchase_count}</td>
                        <td className="px-4 py-3.5 text-sm text-[var(--muted)]">{formatDate(c.last_purchase_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
