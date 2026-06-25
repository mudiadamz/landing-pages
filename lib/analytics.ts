"use client";

export type AnalyticsItem = {
  item_id: string;
  item_name?: string;
  price?: number;
  quantity?: number;
};

export type AnalyticsParams = {
  value?: number;
  currency?: string;
  transaction_id?: string;
  items?: AnalyticsItem[];
  /** Shared dedup id for the Meta pixel (matches the server CAPI event_id). */
  eventId?: string;
};

type GtagWindow = {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
};

/** Maps our GA4-style event names to Meta Pixel standard events. */
const FB_EVENT_MAP: Record<string, string> = {
  view_item: "ViewContent",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
};

/**
 * Fire a commerce event to GA4 (gtag) and Meta Pixel (fbq) if either is loaded.
 * No-ops safely when neither script is present (e.g. env IDs unset), so call
 * sites never need to guard.
 */
export function trackEvent(name: string, params: AnalyticsParams = {}): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as GtagWindow;

  if (typeof w.gtag === "function") {
    w.gtag("event", name, params);
  }

  if (typeof w.fbq === "function") {
    const fbName = FB_EVENT_MAP[name];
    if (fbName) {
      const fbParams = {
        value: params.value,
        currency: params.currency,
        content_ids: params.items?.map((i) => i.item_id),
        content_type: "product",
      };
      // Pass eventID so this browser event dedupes with the server CAPI event.
      if (params.eventId) {
        w.fbq("track", fbName, fbParams, { eventID: params.eventId });
      } else {
        w.fbq("track", fbName, fbParams);
      }
    }
  }
}
