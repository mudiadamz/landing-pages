import { getMyBusinessMoney } from "@/lib/actions/business-money";
import { PanelPageHeader } from "@/components/panel-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { KycForm } from "./kyc-form";

export const metadata = { title: "Business saya" };

function rupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * A business owner/admin's own money view (docs/plans/multi-business-saas.md,
 * Fase 3): balance, KYC status, and the payout bank form. Membership is the gate
 * inside getMyBusinessMoney — no requirePlatform.
 */
export default async function MyBusinessPage() {
  const money = await getMyBusinessMoney();

  if (!money) {
    return (
      <div className="max-w-xl space-y-6">
        <PanelPageHeader backHref="/panel" title="Business saya" description="Keuangan business kamu." />
        <EmptyState title="Belum ada business" description="Kamu belum mengelola business mana pun." />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PanelPageHeader backHref="/panel" title={money.name} description="Saldo, payout, dan verifikasi (KYC)." />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Saldo total" value={rupiah(money.balances.total)} strong />
        <Stat label="Bisa ditarik" value={rupiah(money.balances.available)} />
        <Stat label="Pending (hold)" value={rupiah(money.balances.pending)} />
      </div>

      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Verifikasi & rekening payout</h2>
          <span className="rounded bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted)]">KYC: {money.kyc_status}</span>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Isi rekening untuk menerima payout. Platform akan meninjau sebelum payout bisa dicairkan.
        </p>
        <KycForm
          bankName={money.payout_bank_name ?? ""}
          bankCode={money.payout_bank_code ?? ""}
          bankAccount={money.payout_bank_account ?? ""}
          bankHolder={money.payout_bank_holder ?? ""}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Riwayat ledger</h2>
        {money.entries.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Belum ada transaksi.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-3 py-3 font-medium">Jenis</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {money.entries.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2.5 text-[var(--muted)]">{new Date(e.created_at).toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2.5">{e.kind}</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{e.status}</td>
                    <td className={`px-3 py-2.5 text-right font-medium ${e.amount_cents < 0 ? "text-red-600" : "text-foreground"}`}>
                      {rupiah(e.amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className={`mt-1 ${strong ? "text-lg font-semibold" : "text-base"} text-foreground`}>{value}</div>
    </div>
  );
}
