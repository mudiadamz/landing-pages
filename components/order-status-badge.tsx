"use client";

import { useT } from "@/lib/i18n/client";
import type { FulfillmentStatus, ProductType } from "@/lib/product-type";
import type { MessageKey } from "@/lib/i18n";

/**
 * How far an order has got, as a chip.
 *
 * A client component so the seller's table and the buyer's purchase list render
 * the same thing from the same vocabulary — the alternative was a server copy
 * and a client copy that drift the first time a status is renamed.
 *
 * It says nothing about access. A cancelled order's buyer may still own what
 * they bought; that is `revoked_at`'s business, and conflating the two here
 * would put a "no longer yours" chip on something the reader still opens.
 */

const LABEL: Record<FulfillmentStatus, MessageKey> = {
  pending: "order.statusPending",
  processing: "order.statusProcessing",
  done: "order.statusDone",
  cancelled: "order.statusCancelled",
};

const TONE: Record<FulfillmentStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  processing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  done: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-[var(--muted)]/10 text-[var(--muted)]",
};

const TYPE_LABEL: Record<ProductType, MessageKey> = {
  digital: "product.typeDigital",
  physical: "product.typePhysical",
  service: "product.typeService",
};

export function OrderStatusBadge({ status }: { status: FulfillmentStatus }) {
  const t = useT();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE[status]}`}
    >
      {t(LABEL[status])}
    </span>
  );
}

/**
 * What kind of thing a product is. Rendered only for the kinds that change what
 * a buyer should expect — a digital product is the assumption everything else
 * in this catalog was built on, so labelling it adds noise, not information.
 */
export function ProductTypeBadge({ type }: { type: ProductType }) {
  const t = useT();
  if (type === "digital") return null;
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
      {t(TYPE_LABEL[type])}
    </span>
  );
}
