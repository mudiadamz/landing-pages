"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updatePlanLimits, updatePlanPrices } from "@/lib/actions/site-settings";
import { useT } from "@/lib/i18n/client";
import {
  PAID_PLAN_KEYS,
  PLAN_LIST,
  formatRupiah,
  type PaidPlanKey,
  type PlanKey,
  type PlanLimits,
  type PlanPrices,
} from "@/lib/plans";

/**
 * One card per plan: what it costs here, and what it actually allows.
 *
 * A card rather than a table row, because there are now six editable fields per
 * plan and a six-column table on a phone is the horizontal scroll this panel
 * spent a session removing.
 *
 * The values shown are the ones IN FORCE — the shipped default where nothing has
 * been overridden, the stored number where something has. There is deliberately
 * no visual distinction between the two: what matters when you are setting a
 * quota is what the quota is, not where it came from.
 */
export function PlansForm({
  initialPrices,
  initialLimits,
}: {
  initialPrices: PlanPrices;
  /** Resolved limits: defaults already merged with whatever this site stored. */
  initialLimits: Record<PlanKey, PlanLimits>;
}) {
  const t = useT();
  const [prices, setPrices] = useState<PlanPrices>(initialPrices);
  const [limits, setLimits] = useState<Record<PlanKey, PlanLimits>>(initialLimits);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setPrice = (plan: PaidPlanKey, raw: string) => {
    // Digits only: a price is typed, pasted and mistyped, and Number("12.000")
    // is 12 — which would sell a month of Pro for twelve rupiah.
    const digits = raw.replace(/\D/g, "");
    setPrices((p) => ({ ...p, [plan]: digits ? Math.min(Number(digits), 100_000_000) : 0 }));
    setStatus(null);
  };

  const setLimit = (plan: PlanKey, field: keyof PlanLimits, value: PlanLimits[keyof PlanLimits]) => {
    setLimits((l) => ({ ...l, [plan]: { ...l[plan], [field]: value } }));
    setStatus(null);
  };

  /** Empty means "no ceiling" for the two fields that have one. */
  const setCount = (plan: PlanKey, field: "chatMessagesPerDay" | "maxProducts", raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setLimit(plan, field, digits === "" ? null : Number(digits));
  };

  async function save() {
    setSaving(true);
    setError(null);
    const [priceResult, limitResult] = await Promise.all([
      updatePlanPrices(prices),
      updatePlanLimits(limits),
    ]);
    setSaving(false);
    const failed = !priceResult.ok ? priceResult : !limitResult.ok ? limitResult : null;
    if (failed) setError(failed.error ?? t("common.failed"));
    else setStatus(t("common.saved"));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {PLAN_LIST.map((def) => {
          const paid = (PAID_PLAN_KEYS as string[]).includes(def.key);
          const price = paid ? prices[def.key as PaidPlanKey] : 0;
          const l = limits[def.key];

          return (
            <div key={def.key} className="rounded-xl border border-[var(--border)] p-4">
              <h2 className="text-sm font-semibold">{def.label}</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{def.note}</p>

              {paid && (
                <label className="mt-3 block">
                  <span className="text-xs font-medium text-[var(--muted)]">{t("plan.colPrice")}</span>
                  <input
                    inputMode="numeric"
                    value={price ? String(price) : ""}
                    onChange={(e) => setPrice(def.key as PaidPlanKey, e.target.value)}
                    placeholder="0"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-[var(--primary)]"
                  />
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {price > 0 ? formatRupiah(price) : def.selfServe ? t("plan.notForSale") : t("plan.contactOnly")}
                  </span>
                </label>
              )}

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[var(--muted)]">{t("plan.colMessages")}</span>
                  <input
                    inputMode="numeric"
                    value={l.chatMessagesPerDay === null ? "" : String(l.chatMessagesPerDay)}
                    onChange={(e) => setCount(def.key, "chatMessagesPerDay", e.target.value)}
                    placeholder="∞"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-[var(--primary)]"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-[var(--muted)]">{t("plan.colProducts")}</span>
                  <input
                    inputMode="numeric"
                    value={l.maxProducts === null ? "" : String(l.maxProducts)}
                    onChange={(e) => setCount(def.key, "maxProducts", e.target.value)}
                    placeholder="∞"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-[var(--primary)]"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-[var(--muted)]">{t("plan.colFiles")}</span>
                  <input
                    inputMode="numeric"
                    value={String(l.chatMaxFiles)}
                    onChange={(e) =>
                      setLimit(def.key, "chatMaxFiles", Number(e.target.value.replace(/\D/g, "") || 0))
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-[var(--primary)]"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-[var(--muted)]">{t("plan.colHistory")}</span>
                  <input
                    inputMode="numeric"
                    value={String(l.chatHistory)}
                    onChange={(e) =>
                      setLimit(def.key, "chatHistory", Number(e.target.value.replace(/\D/g, "") || 0))
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-[var(--primary)]"
                  />
                </label>
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={l.chatWebSearch}
                  onChange={(e) => setLimit(def.key, "chatWebSearch", e.target.checked)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                {t("plan.colWeb")}
              </label>

              <p className="mt-2 text-xs text-[var(--muted)]">{t("plan.unlimitedHint")}</p>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--muted)]">{t("plan.pricesNote")}</p>
      <p className="text-xs text-[var(--muted)]">{t("plan.limitsNote")}</p>

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
