import { redirect } from "next/navigation";
import { requirePlatform } from "@/lib/actions/profiles";
import { listBusinessesForPlatform } from "@/lib/actions/platform";
import { PanelPageHeader } from "@/components/panel-page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Platform" };

function rupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Platform operator overview — every business on the platform, read-only
 * (docs/plans/multi-business-saas.md, Fase 4). Balances are ledger-derived.
 * Only the Platform (is_platform) reaches this.
 */
export default async function PlatformPage() {
  if (!(await requirePlatform())) redirect("/panel");
  const businesses = await listBusinessesForPlatform();

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title="Platform" description="Semua business di platform ini." />

      {businesses.length === 0 ? (
        <EmptyState title="Belum ada business" description="Business akan muncul di sini setelah dibuat." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-3 py-3 font-medium">Tipe</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Paket</th>
                <th className="px-3 py-3 text-right font-medium">Komisi</th>
                <th className="px-3 py-3 text-right font-medium">Anggota</th>
                <th className="px-3 py-3 text-right font-medium">Saldo</th>
                <th className="px-3 py-3 text-right font-medium">Pending (hold)</th>
                <th className="px-3 py-3 font-medium">KYC</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => (
                <tr key={b.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-foreground">{b.name}</span>
                    <span className="ml-2 font-mono text-xs text-[var(--muted)]">{b.slug}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {b.business_type === "company" ? "Perusahaan" : "Perorangan"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        b.status === "active"
                          ? "bg-green-500/10 text-green-700 dark:text-green-400"
                          : "bg-[var(--background)] text-[var(--muted)]"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{b.plan}</td>
                  <td className="px-3 py-2.5 text-right text-[var(--muted)]">{b.commission_pct}%</td>
                  <td className="px-3 py-2.5 text-right text-[var(--muted)]">{b.members}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-foreground">{rupiah(b.balance)}</td>
                  <td className="px-3 py-2.5 text-right text-[var(--muted)]">{rupiah(b.pending)}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{b.kyc_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[var(--muted)]">
        Saldo dihitung dari ledger (SUM). Payout & KYC dikelola terpisah (belum aktif).
      </p>
    </div>
  );
}
