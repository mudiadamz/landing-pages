"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updatePlanLimits, updatePlanMeta, updatePlanPrices } from "@/lib/actions/site-settings";
import { useT } from "@/lib/i18n/client";
import {
  PAID_PLAN_KEYS,
  PLAN_LIST,
  formatRupiah,
  type PaidPlanKey,
  type PlanKey,
  type PlanLimits,
  type PlanMeta,
  type PlanMetaOverride,
  type PlanPrices,
} from "@/lib/plans";

/**
 * One card per tier: what it is CALLED here, what it costs, and what it allows.
 *
 * A card rather than a table row, because there are now nine editable fields per
 * tier and a nine-column table on a phone is the horizontal scroll this panel
 * spent a session removing.
 *
 * The values shown are the ones IN FORCE — the shipped default where nothing has
 * been overridden, the stored value where something has. There is deliberately
 * no visual distinction between the two: what matters when you are setting a
 * quota is what the quota is, not where it came from.
 *
 * Three settings keys are written by ONE button. They are separate rows in
 * lp_site_settings because they answer separate questions, but they are edited
 * as one screen, and a save that stored the price and dropped the name would be
 * a save the admin cannot reason about.
 */
export function PlansForm({
  initialPrices,
  initialLimits,
  initialMeta,
  siteId,
}: {
  /** Situs yang sedang difilter — tulisan harus mendarat di situs yang sama dengan bacaan. */
  siteId: string;
  initialPrices: PlanPrices;
  /** Resolved limits: defaults already merged with whatever this site stored. */
  initialLimits: Record<PlanKey, PlanLimits>;
  /** Resolved names/visibility, same merge. */
  initialMeta: { enabled: boolean; plans: Record<PlanKey, PlanMetaOverride> };
}) {
  const t = useT();
  const [prices, setPrices] = useState<PlanPrices>(initialPrices);
  const [limits, setLimits] = useState<Record<PlanKey, PlanLimits>>(initialLimits);
  const [enabled, setEnabled] = useState(initialMeta.enabled);
  const [meta, setMeta] = useState<Record<PlanKey, PlanMetaOverride>>(initialMeta.plans);
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

  const setMetaField = <K extends keyof PlanMetaOverride>(
    plan: PlanKey,
    field: K,
    value: PlanMetaOverride[K],
  ) => {
    setMeta((m) => ({ ...m, [plan]: { ...m[plan], [field]: value } }));
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
    const [priceResult, limitResult, metaResult] = await Promise.all([
      updatePlanPrices(prices, siteId),
      updatePlanLimits(limits, siteId),
      updatePlanMeta({ enabled, plans: meta } as PlanMeta, siteId),
    ]);
    setSaving(false);
    const failed = !priceResult.ok
      ? priceResult
      : !limitResult.ok
        ? limitResult
        : !metaResult.ok
          ? metaResult
          : null;
    if (failed) setError(failed.error ?? t("common.failed"));
    else setStatus(t("common.saved"));
  }

  const shownCount = PLAN_LIST.filter((def) => meta[def.key]?.visible).length;

  return (
    <div className="space-y-4">
      {/* The master switch, above everything it governs. Off is not "the table is
          empty" — /upgrade stops existing and every Upgrade button in the chat
          disappears with it, so the switch says so rather than leaving the admin
          to discover it. */}
      <div className="rounded-xl border border-[var(--border)] p-4">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setStatus(null);
            }}
            className="h-5 w-5 accent-[var(--primary)]"
          />
          {t("plan.showToVisitors")}
        </label>
        <p className="mt-1.5 text-xs text-[var(--muted)]">{t("plan.showToVisitorsNote")}</p>
        {enabled && shownCount === 0 && (
          <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-500">
            {t("plan.noneVisible")}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {PLAN_LIST.map((def) => {
          const paid = (PAID_PLAN_KEYS as string[]).includes(def.key);
          const price = paid ? prices[def.key as PaidPlanKey] : 0;
          const l = limits[def.key];
          const m = meta[def.key];
          // A slot nobody has named yet. Named by its shipped label ("Tier 5")
          // and shipped hidden, so it reads as capacity rather than as a tier
          // somebody forgot to fill in.
          const spare = !def.visible;

          return (
            <div
              key={def.key}
              className={`rounded-xl border p-4 transition-opacity ${
                m.visible ? "border-[var(--border)]" : "border-dashed border-[var(--border)] opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <label className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-[var(--muted)]">{t("plan.tierName")}</span>
                  <input
                    value={m.label}
                    onChange={(e) => setMetaField(def.key, "label", e.target.value)}
                    maxLength={40}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-[var(--primary)]"
                  />
                </label>
                <label className="mt-5 flex shrink-0 items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={m.visible}
                    onChange={(e) => setMetaField(def.key, "visible", e.target.checked)}
                    className="h-5 w-5 accent-[var(--primary)]"
                  />
                  {t("plan.tierVisible")}
                </label>
              </div>

              {spare && <p className="mt-1.5 text-xs text-[var(--muted)]">{t("plan.spareSlot")}</p>}

              <label className="mt-3 block">
                <span className="text-xs font-medium text-[var(--muted)]">{t("plan.tierNote")}</span>
                <input
                  value={m.note}
                  onChange={(e) => setMetaField(def.key, "note", e.target.value)}
                  maxLength={160}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                />
              </label>

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
                  className="h-5 w-5 accent-[var(--primary)]"
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
      {/* Renaming is cosmetic; the KEY underneath never changes, which is why a
          rename cannot strand anybody already on the tier. Worth saying once, on
          the screen where somebody is about to do it. */}
      <p className="text-xs text-[var(--muted)]">{t("plan.renameNote")}</p>

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
