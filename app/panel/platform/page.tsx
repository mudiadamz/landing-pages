import Link from "next/link";
import { redirect } from "next/navigation";
import { deniedPath } from "@/lib/panel-view";
import { requirePlatform } from "@/lib/actions/profiles";
import { listBusinessesForPlatform } from "@/lib/actions/platform";
import { PanelPageHeader } from "@/components/panel-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PendingActions } from "./pending-actions";

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
  if (!(await requirePlatform())) redirect(deniedPath("platform"));
  const businesses = await listBusinessesForPlatform();
  const pending = businesses.filter((b) => b.status === "pending");

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title="Platform" description="Semua business di platform ini." />

      {pending.length > 0 && (
        <section className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold text-foreground">
            Pengajuan menunggu persetujuan ({pending.length})
          </h2>
          <ul className="space-y-3">
            {pending.map((b) => (
              <li
                key={b.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{b.name}</span>
                    <span className="rounded bg-[var(--background)] px-1.5 py-0.5 text-xs text-[var(--muted)]">
                      {b.business_type === "company" ? "Perusahaan" : "Perorangan"}
                    </span>
                  </div>
                  <div className="mt-0.5 space-x-2 text-xs text-[var(--muted)]">
                    {b.contact_email && <span>{b.contact_email}</span>}
                    {b.desired_host && <span className="font-mono">{b.desired_host}</span>}
                  </div>
                  {b.note && <p className="mt-1 text-xs text-[var(--muted)]">{b.note}</p>}
                </div>
                <PendingActions id={b.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

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
                    <Link href={`/panel/platform/${b.id}`} className="font-medium text-foreground hover:underline">
                      {b.name}
                    </Link>
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
