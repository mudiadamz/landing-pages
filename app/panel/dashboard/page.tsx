import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/actions/profiles";
import { getStats, getCustomers } from "@/lib/actions/admin";

export default async function DashboardPage() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin" || !profile;
  if (!isAdmin) redirect("/panel");

  const [stats, customers] = await Promise.all([
    getStats(),
    getCustomers(),
  ]);

  if (!stats) return null;

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

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm">
          <p className="text-sm font-medium text-[var(--muted)]">Landing pages</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-foreground">
            {stats.totalLandingPages}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm">
          <p className="text-sm font-medium text-[var(--muted)]">Total purchases</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-foreground">
            {stats.totalPurchases}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm">
          <p className="text-sm font-medium text-[var(--muted)]">Customers</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-foreground">
            {stats.totalCustomers}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Customer list</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                  <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">
                    Nama
                  </th>
                  <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">
                    Email
                  </th>
                  <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">
                    Purchases
                  </th>
                  <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">
                    Last purchase
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center text-sm text-[var(--muted)]"
                    >
                      No customers yet
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {c.full_name || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[var(--muted)]">
                        {c.email || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-foreground">
                        {c.purchase_count}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[var(--muted)]">
                        {formatDate(c.last_purchase_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
