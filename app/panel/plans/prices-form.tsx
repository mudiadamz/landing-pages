"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updatePlanPrices } from "@/lib/actions/site-settings";
import { useT } from "@/lib/i18n/client";
import {
  PAID_PLAN_KEYS,
  PLAN_LIST,
  formatRupiah,
  type PaidPlanKey,
  type PlanPrices,
} from "@/lib/plans";

/**
 * One row per plan: what it includes, and what it costs per year here.
 *
 * The limits come from the registry rather than from the database, so this table
 * cannot drift from what the chat route actually enforces — if the two ever
 * disagree, the screen is lying to the person setting the price.
 */
export function PlanPricesForm({ initial }: { initial: PlanPrices }) {
  const t = useT();
  const [prices, setPrices] = useState<PlanPrices>(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (plan: PaidPlanKey, raw: string) => {
    // Digits only: a price is typed, pasted and mistyped, and Number("12.000")
    // is 12 — which would sell a year of Pro for twelve rupiah.
    const digits = raw.replace(/\D/g, "");
    setPrices((p) => ({ ...p, [plan]: digits ? Math.min(Number(digits), 100_000_000) : 0 }));
    setStatus(null);
  };

  async function save() {
    setSaving(true);
    setError(null);
    const result = await updatePlanPrices(prices);
    setSaving(false);
    if (result.ok) setStatus(t("common.saved"));
    else setError(result.error ?? t("common.failed"));
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--accent-subtle)]/40 text-left">
              <th className="px-3 py-2 font-medium">{t("plan.colPlan")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("plan.colMessages")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("plan.colProducts")}</th>
              <th className="px-3 py-2 font-medium">{t("plan.colWeb")}</th>
              <th className="px-3 py-2 font-medium">{t("plan.colPrice")}</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_LIST.map((plan) => {
              const paid = (PAID_PLAN_KEYS as string[]).includes(plan.key);
              const price = paid ? prices[plan.key as PaidPlanKey] : 0;
              return (
                <tr key={plan.key} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{plan.label}</span>
                    <span className="mt-0.5 block max-w-xs text-xs text-[var(--muted)]">{plan.note}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {plan.limits.chatMessagesPerDay ?? "∞"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{plan.limits.maxProducts ?? "∞"}</td>
                  <td className="px-3 py-2.5">
                    {plan.limits.chatWebSearch ? t("plan.yes") : t("plan.no")}
                  </td>
                  <td className="px-3 py-2.5">
                    {!paid ? (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    ) : (
                      <>
                        <input
                          inputMode="numeric"
                          value={price ? String(price) : ""}
                          onChange={(e) => set(plan.key as PaidPlanKey, e.target.value)}
                          placeholder="0"
                          aria-label={`${t("plan.colPrice")} ${plan.label}`}
                          className="w-32 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-[var(--primary)]"
                        />
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">
                          {price > 0
                            ? formatRupiah(price)
                            : plan.selfServe
                              ? t("plan.notForSale")
                              : t("plan.contactOnly")}
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--muted)]">{t("plan.pricesNote")}</p>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
        {status && <span className="text-xs text-[var(--muted)]">{status}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
