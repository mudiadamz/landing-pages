"use client";

import { useT } from "@/lib/i18n/client";
import { formatShipping, type ShippingAddress } from "@/lib/shipping";

/**
 * Where a parcel is going, folded away until asked for.
 *
 * Collapsed by default because a sales table is read for figures far more often
 * than for one buyer's street — and because an address left on permanent
 * display is somebody's home, shown to whoever glances at the seller's screen.
 *
 * One component for both sides on purpose: the seller reading it off an order
 * and the buyer checking they typed it right are looking at the same address,
 * and two renderings of it would be two chances to format it differently.
 *
 * An order with no address says so rather than rendering blank. Physical orders
 * placed before the column existed genuinely have none, and a seller needs to
 * know to go and ask instead of squinting at an empty box.
 */
export function ShipTo({ address }: { address: ShippingAddress | null }) {
  const t = useT();

  if (!address) {
    return <p className="text-xs text-[var(--muted)]">{t("shipping.none")}</p>;
  }

  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-[var(--muted)] hover:text-foreground">
        {t("shipping.panelHeading")}
      </summary>
      <div className="mt-1 space-y-0.5 rounded-lg bg-[var(--background)] p-2 text-foreground">
        <p className="font-medium">
          {address.name} · {address.phone}
        </p>
        <p className="text-[var(--muted)]">{formatShipping(address)}</p>
        {address.note && <p className="text-[var(--muted)]">{address.note}</p>}
      </div>
    </details>
  );
}
