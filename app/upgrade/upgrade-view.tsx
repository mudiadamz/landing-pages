"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n";
import {
  PLAN_LIST,
  formatRupiah,
  isPurchasable,
  type PaidPlanKey,
  type PlanKey,
  type PlanLimits,
  type PlanPrices,
} from "@/lib/plans";

/**
 * The four plans as cards, with the one you are on marked.
 *
 * Every plan is shown, including the ones below the current one: a pricing page
 * that hides what you already have makes it impossible to see what you are
 * paying for. Only the buy button is conditional.
 */
export function UpgradeView({
  plan,
  expiresAt,
  prices,
  limits,
  signedIn,
  pending,
  locale,
}: {
  plan: PlanKey;
  expiresAt: string | null;
  prices: PlanPrices;
  /** Resolved per storefront, so the card and the chat route agree. */
  limits: Record<PlanKey, PlanLimits>;
  signedIn: boolean;
  /** An order came back from Duitku and the callback has not landed yet. */
  pending: boolean;
  locale: Locale;
}) {
  const t = useT();
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(target: PlanKey) {
    setBusy(target);
    setError(null);
    try {
      const res = await fetch("/api/plans/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target, months: 1 }),
      });
      const data = (await res.json()) as { paymentUrl?: string; error?: string };
      if (!res.ok || !data.paymentUrl) {
        setError(data.error ?? t("plan.buyFailed"));
        setBusy(null);
        return;
      }
      // Straight to the gateway. No interstitial: the invoice is already created,
      // and a "redirecting…" screen is one more place for someone to stop.
      //
      // assign() rather than `location.href = …`: the compiler's immutability rule
      // rejects writing to that property inside a component, and a method call
      // does the same navigation without arguing about it.
      window.location.assign(data.paymentUrl);
    } catch {
      setError(t("plan.buyFailed"));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("plan.chooseTitle")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("plan.chooseIntro")}</p>
      </header>

      {pending && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--accent-subtle)] px-4 py-3 text-center text-sm">
          {t("plan.pending")}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/40 px-4 py-3 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_LIST.map((def) => {
          const isCurrent = def.key === plan;
          const price = def.key === "free" ? 0 : prices[def.key as PaidPlanKey];
          const canBuy = isPurchasable(def.key, prices) && !isCurrent;
          const l = limits[def.key];

          return (
            <div
              key={def.key}
              className={`flex flex-col rounded-2xl border p-4 ${
                isCurrent ? "border-[var(--primary)] bg-[var(--accent-subtle)]/40" : "border-[var(--border)]"
              }`}
            >
              <h2 className="text-lg font-semibold">{def.label}</h2>
              <p className="mt-1 min-h-[3rem] text-xs text-[var(--muted)]">{def.note}</p>

              <p className="mt-2 text-xl font-semibold tabular-nums">
                {price > 0 ? (
                  <>
                    {formatRupiah(price)}
                    <span className="text-xs font-normal text-[var(--muted)]">{t("plan.perMonth")}</span>
                  </>
                ) : (
                  <span className="text-base font-normal text-[var(--muted)]">
                    {def.key === "free" ? formatRupiah(0) : t("plan.contactUs")}
                  </span>
                )}
              </p>

              <ul className="mt-3 flex-1 space-y-1 text-xs text-[var(--muted)]">
                <li>
                  {t("plan.colMessages")}: {l.chatMessagesPerDay ?? "∞"}
                </li>
                <li>
                  {t("plan.colWeb")}: {l.chatWebSearch ? t("plan.yes") : t("plan.no")}
                </li>
                <li>
                  {t("plan.colProducts")}: {l.maxProducts ?? "∞"}
                </li>
              </ul>

              <div className="mt-4">
                {isCurrent ? (
                  <div className="rounded-xl bg-[var(--primary)]/10 px-3 py-2 text-center text-xs font-medium text-[var(--primary)]">
                    {t("plan.current")}
                    {expiresAt && (
                      <span className="mt-0.5 block font-normal text-[var(--muted)]">
                        {t("plan.activeUntil", {
                          date: new Date(expiresAt).toLocaleDateString(
                            locale === "en" ? "en-GB" : "id-ID",
                          ),
                        })}
                      </span>
                    )}
                  </div>
                ) : !signedIn ? (
                  <Link
                    href="/login?next=/upgrade"
                    className="block rounded-xl border border-[var(--border)] px-3 py-2 text-center text-sm transition-colors hover:border-[var(--primary)]"
                  >
                    {t("plan.signInFirst")}
                  </Link>
                ) : canBuy ? (
                  <button
                    type="button"
                    onClick={() => buy(def.key)}
                    disabled={busy !== null}
                    className="w-full rounded-xl bg-[var(--primary)] px-3 py-2 text-sm text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === def.key ? t("common.loading") : t("plan.choose")}
                  </button>
                ) : def.key === "free" ? null : (
                  <Link
                    href="/contact"
                    className="block rounded-xl border border-[var(--border)] px-3 py-2 text-center text-sm transition-colors hover:border-[var(--primary)]"
                  >
                    {t("plan.contactUs")}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
