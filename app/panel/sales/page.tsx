import { redirect } from "next/navigation";
import Link from "next/link";
import { getSalesOverview, type SalesOverview, type RecentSale } from "@/lib/actions/sales";
import { getCustomers, type CustomerRow } from "@/lib/actions/admin";
import { CustomerPurchasesButton } from "./customer-purchases";

export const metadata = { title: "Penjualan" };

/**
 * Sales monitoring for admins and publishers.
 *
 * Was /panel/stats, and was mostly a customer directory: the admin view listed
 * who had bought but never said how much money came in, and neither view showed
 * a single transaction. Both are now here, and the page is organised around the
 * question it exists to answer — what sold, for how much, and to whom.
 *
 * Scope is decided in getSalesOverview(), not here: a publisher gets figures for
 * their own products only, and the customer directory (which carries the revoke
 * controls) stays admin-only.
 */

const nf = (n: number) => n.toLocaleString("id-ID");
const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SalesPage() {
  const data = await getSalesOverview();
  if (!data) redirect("/panel");

  // The customer directory is the admin's tool for withdrawing access, so it
  // only loads for the global view.
  const customers = data.scope === "global" ? await getCustomers() : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Penjualan</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {data.scope === "global"
            ? "Seluruh transaksi di situs."
            : "Transaksi dari produk Anda sendiri."}
        </p>
      </div>

      <Summary data={data} />

      <RecentSales rows={data.recent} />

      <PerProduct data={data} />

      {data.scope === "global" && <Customers customers={customers} />}
    </div>
  );
}

function Summary({ data }: { data: SalesOverview }) {
  return (
    <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      <Card
        label="Pendapatan"
        value={idr(data.revenueTotal)}
        sub={`${idr(data.revenue30)} · 30 hari terakhir`}
      />
      <Card
        label="Terjual"
        value={
          <>
            {nf(data.salesTotal)}
            {data.salesRevoked > 0 && (
              <span
                title={`${data.salesRevoked} pembelian aksesnya dicabut`}
                className="text-red-600 dark:text-red-400"
              >
                {" "}({nf(data.salesRevoked)})
              </span>
            )}
          </>
        }
        sub={`${nf(data.sales30)} · 30 hari terakhir`}
      />
      <Card label="Produk" value={nf(data.productCount)} />
      {data.scope === "global" ? (
        <Card label="Pembeli" value={nf(data.buyerCount)} />
      ) : (
        <Card
          label="Akses aktif"
          value={nf(data.salesTotal - data.salesRevoked)}
          sub="terjual dikurangi yang dicabut"
        />
      )}
    </section>
  );
}

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-foreground sm:text-2xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

/** The page's reason to exist: what actually happened, most recent first. */
function RecentSales({ rows }: { rows: RecentSale[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Transaksi terbaru
      </h2>

      {rows.length === 0 ? (
        <Empty>Belum ada transaksi.</Empty>
      ) : (
        <>
          <ul className="space-y-3 sm:hidden">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 font-medium text-foreground">{r.productTitle}</p>
                  <p className="shrink-0 text-sm font-semibold text-foreground">{idr(r.amount)}</p>
                </div>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">
                  {r.buyerName || r.buyerEmail || "—"}
                </p>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  {formatDate(r.at)}
                  {r.method ? ` · ${r.method}` : ""}
                  {r.revoked && <RevokedTag />}
                </p>
              </li>
            ))}
          </ul>

          <Table
            head={["Produk", "Pembeli", "Waktu", "Metode", "Jumlah"]}
            align={["left", "left", "left", "left", "right"]}
          >
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--background)]/30"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {r.productTitle}
                  {r.revoked && <RevokedTag />}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">
                  {r.buyerName || r.buyerEmail || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{formatDate(r.at)}</td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{r.method || "—"}</td>
                <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                  {idr(r.amount)}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </section>
  );
}

function PerProduct({ data }: { data: SalesOverview }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Per produk
      </h2>

      {data.products.length === 0 ? (
        <Empty>Belum ada produk.</Empty>
      ) : (
        <>
          <ul className="space-y-3 sm:hidden">
            {data.products.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <p className="font-medium text-foreground">{p.title}</p>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  {nf(p.sold)} terjual
                  {p.revoked > 0 && (
                    <span className="text-red-600 dark:text-red-400"> ({nf(p.revoked)} dicabut)</span>
                  )}{" "}
                  · {idr(p.revenue)}
                </p>
              </li>
            ))}
          </ul>

          <Table
            head={["Produk", "Terjual", "Dicabut", "Pendapatan"]}
            align={["left", "right", "right", "right"]}
          >
            {data.products.map((p) => (
              <tr
                key={p.id}
                className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--background)]/30"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  <Link href={`/panel/product/${p.id}/stats`} className="hover:text-[var(--primary)]">
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right text-sm text-foreground">{nf(p.sold)}</td>
                <td className="px-4 py-3 text-right text-sm">
                  {p.revoked > 0 ? (
                    <span className="text-red-600 dark:text-red-400">{nf(p.revoked)}</span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm text-[var(--muted)]">
                  {idr(p.revenue)}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </section>
  );
}

function Customers({ customers }: { customers: CustomerRow[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        Pelanggan
      </h2>

      {customers.length === 0 ? (
        <Empty>Belum ada pelanggan.</Empty>
      ) : (
        <>
          <ul className="space-y-3 sm:hidden">
            {customers.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <p className="font-medium text-foreground">{c.full_name || "—"}</p>
                <p className="mt-0.5 break-all text-sm text-[var(--muted)]">{c.email || "—"}</p>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  {nf(c.purchase_count)} pembelian
                  {c.revoked_count > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      {" "}({nf(c.revoked_count)} dicabut)
                    </span>
                  )}{" "}
                  · {formatDate(c.last_purchase_at)}
                </p>
                <div className="mt-3">
                  <CustomerPurchasesButton
                    userId={c.id}
                    name={c.full_name || c.email || "pelanggan"}
                    count={c.purchase_count}
                  />
                </div>
              </li>
            ))}
          </ul>

          <Table
            head={["Nama", "Email", "Pembelian", "Terakhir", "Akses"]}
            align={["left", "left", "left", "left", "right"]}
          >
            {customers.map((c) => (
              <tr
                key={c.id}
                className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--background)]/30"
              >
                <td className="px-4 py-3 font-medium text-foreground">{c.full_name || "—"}</td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{c.email || "—"}</td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {nf(c.purchase_count)}
                  {c.revoked_count > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      {" "}({nf(c.revoked_count)})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">
                  {formatDate(c.last_purchase_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <CustomerPurchasesButton
                    userId={c.id}
                    name={c.full_name || c.email || "pelanggan"}
                    count={c.purchase_count}
                  />
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </section>
  );
}

function Table({
  head,
  align,
  children,
}: {
  head: string[];
  align: ("left" | "right")[];
  children: React.ReactNode;
}) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm sm:block">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
              {head.map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-sm font-medium text-foreground ${
                    align[i] === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function RevokedTag() {
  return (
    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      dicabut
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
      <p className="text-sm text-[var(--muted)]">{children}</p>
    </div>
  );
}
