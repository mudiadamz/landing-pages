import { redirect, notFound } from "next/navigation";
import { requirePlatform } from "@/lib/actions/profiles";
import { getBusinessMoney } from "@/lib/actions/business-money";
import { MIN_PAYOUT } from "@/lib/ledger";
import { PanelPageHeader } from "@/components/panel-page-header";
import { KycControls, PayoutControl, RefundControl } from "./money-controls";

export const metadata = { title: "Business — keuangan" };

type Props = { params: Promise<{ id: string }> };

function rupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Platform view of one business's money (docs/plans/multi-business-saas.md, Fase 3).
 * KYC review, payout recording and refund recording — all bookkeeping, no
 * disbursement API. Platform-only.
 */
export default async function BusinessMoneyPage({ params }: Props) {
  if (!(await requirePlatform())) redirect("/panel");
  const { id } = await params;
  const money = await getBusinessMoney(id);
  if (!money) notFound();

  const bankReady = !!money.payout_bank_account;

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel/platform" title={money.name} description="Keuangan business (ledger, KYC, payout, refund)." />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Saldo total" value={rupiah(money.balances.total)} strong />
        <Stat label="Tersedia (matang)" value={rupiah(money.balances.available)} />
        <Stat label="Pending (hold)" value={rupiah(money.balances.pending)} />
      </div>

      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold text-foreground">KYC & rekening payout</h2>
        <KycControls id={money.id} status={money.kyc_status} />
        <div className="text-xs text-[var(--muted)]">
          {bankReady ? (
            <>
              {money.payout_bank_name} · {money.payout_bank_account} · a.n. {money.payout_bank_holder}
            </>
          ) : (
            "Rekening payout belum diisi oleh business."
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold text-foreground">Catat payout</h2>
        <p className="text-xs text-[var(--muted)]">
          Mencatat bahwa payout sudah dibayar (transfer bank dilakukan manual di luar sistem).
          Minimum {rupiah(MIN_PAYOUT)}, butuh KYC disetujui.
        </p>
        <PayoutControl id={money.id} available={money.balances.available} />
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold text-foreground">Catat refund</h2>
        <RefundControl id={money.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Ledger</h2>
        {money.entries.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Belum ada transaksi.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-3 py-3 font-medium">Jenis</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Order</th>
                  <th className="px-3 py-3 text-right font-medium">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {money.entries.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-2.5 text-[var(--muted)]">{new Date(e.created_at).toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2.5">{e.kind}</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{e.status}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted)]">{e.order_ref ?? "—"}</td>
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
