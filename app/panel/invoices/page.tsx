import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/actions/profiles";
import { getInvoicesForUser } from "@/lib/actions/purchases";

function formatPrice(value: number): string {
  if (value === 0) return "Gratis";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function InvoicesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const invoices = await getInvoicesForUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Riwayat Pembelian</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Daftar semua pembelian dan invoice kamu.
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <p className="text-sm text-[var(--muted)]">Belum ada pembelian.</p>
          <Link
            href="/"
            className="inline-block mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity"
          >
            Jelajahi landing page
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Invoice</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Produk</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Tanggal</th>
                  <th className="text-right px-4 py-3 font-medium text-[var(--muted)]">Amount</th>
                  <th className="text-center px-4 py-3 font-medium text-[var(--muted)]">Metode</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                      {inv.invoice_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{inv.title}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{formatDate(inv.purchased_at)}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatPrice(inv.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent-subtle)] text-[var(--muted)]">
                        {inv.payment_method ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/panel/invoices/${inv.id}`}
                        className="text-xs font-medium text-[var(--primary)] hover:underline"
                      >
                        Lihat
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-[var(--border)]">
            {invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/panel/invoices/${inv.id}`}
                className="block px-4 py-4 hover:bg-[var(--background)]/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{inv.title}</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatPrice(inv.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">
                    {inv.invoice_number ?? "No invoice"} · {formatDate(inv.purchased_at)}
                  </span>
                  <span className="text-xs text-[var(--primary)]">Lihat →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
