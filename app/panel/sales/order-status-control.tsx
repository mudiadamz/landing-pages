"use client";

import { useState, useTransition } from "react";
import { setPurchaseFulfillment } from "@/lib/actions/fulfillment";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { useT } from "@/lib/i18n/client";
import { nextFulfillmentStatuses, type FulfillmentStatus } from "@/lib/product-type";
import type { MessageKey } from "@/lib/i18n";

const LABEL: Record<FulfillmentStatus, MessageKey> = {
  pending: "order.statusPending",
  processing: "order.statusProcessing",
  done: "order.statusDone",
  cancelled: "order.statusCancelled",
};

/**
 * The seller's one control over an order: move it forward, or cancel it.
 *
 * The options come from `nextFulfillmentStatuses`, the same function the server
 * action checks against — so the dropdown can never offer a transition the save
 * will refuse. A finished order renders as a plain badge with nothing to press,
 * which is the honest shape of "there is nothing left to do here".
 *
 * Optimistic in the narrow sense only: the badge follows the server's answer,
 * not the click. An order that says "Selesai" when the write failed is exactly
 * the lie this screen exists to prevent.
 */
export function OrderStatusControl({
  purchaseId,
  status,
}: {
  purchaseId: string;
  status: FulfillmentStatus;
}) {
  const t = useT();
  const [current, setCurrent] = useState<FulfillmentStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = nextFulfillmentStatuses(current);
  if (options.length === 0) return <OrderStatusBadge status={current} />;

  function choose(next: FulfillmentStatus) {
    setError(null);
    startTransition(async () => {
      const res = await setPurchaseFulfillment(purchaseId, next);
      if (res.ok) setCurrent(next);
      else setError(res.error ?? t("order.saveFailed"));
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <OrderStatusBadge status={current} />
        <select
          aria-label={t("order.update")}
          value=""
          disabled={pending}
          onChange={(e) => e.target.value && choose(e.target.value as FulfillmentStatus)}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 disabled:opacity-50"
        >
          <option value="">{t("order.update")}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {t(LABEL[o])}
            </option>
          ))}
        </select>
      </div>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
