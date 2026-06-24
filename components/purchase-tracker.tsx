"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

type Props = {
  orderId: string;
  value: number;
  slug: string;
  title: string;
};

/**
 * Fires the `purchase` event once when the buyer lands on the success page.
 * Deduped per order id via localStorage so a refresh doesn't double-count.
 */
export function PurchaseTracker({ orderId, value, slug, title }: Props) {
  useEffect(() => {
    const key = `purchase-tracked:${orderId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // localStorage unavailable (private mode) — fall through and still track.
    }
    trackEvent("purchase", {
      transaction_id: orderId,
      currency: "IDR",
      value,
      items: [{ item_id: slug, item_name: title, price: value, quantity: 1 }],
    });
  }, [orderId, value, slug, title]);

  return null;
}
