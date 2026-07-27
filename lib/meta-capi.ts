import crypto from "node:crypto";

/**
 * Server-side Meta Conversions API (CAPI). Sends a Purchase event straight from
 * our payment callback, so conversions are reported even when the browser pixel
 * is blocked or the post-gateway redirect is lost. Deduped against the browser
 * pixel via a shared `eventId` (we pass Duitku's merchantOrderId on both sides).
 *
 * Dormant until BOTH NEXT_PUBLIC_FB_PIXEL_ID and META_CAPI_ACCESS_TOKEN are set,
 * so shipping this is safe before the IDs exist — add them in Vercel to go live.
 */
/**
 * Custom event name. Must match exactly what's selected as the optimisation
 * event in Ads Manager, and what the browser pixel sends.
 */
export const META_READ_EVENT = "ReadEngaged";

/** Active reading time that counts as a genuine read. */
export const READ_THRESHOLD_MS = 30_000;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function sendMetaPurchaseEvent(opts: {
  /** Shared dedup key — must match the browser pixel's eventID (merchantOrderId). */
  eventId: string;
  value: number;
  currency?: string;
  email?: string | null;
  contentId?: string | null;
  contentName?: string | null;
  eventSourceUrl?: string;
  clientIp?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return; // not configured — no-op

  // Meta requires hashed PII (lowercased + trimmed email).
  const userData: Record<string, unknown> = {};
  if (opts.email) userData.em = [sha256(opts.email.trim().toLowerCase())];
  if (opts.clientIp) userData.client_ip_address = opts.clientIp;
  if (opts.userAgent) userData.client_user_agent = opts.userAgent;

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: opts.eventId,
        action_source: "website",
        ...(opts.eventSourceUrl ? { event_source_url: opts.eventSourceUrl } : {}),
        user_data: userData,
        custom_data: {
          currency: opts.currency ?? "IDR",
          value: opts.value,
          ...(opts.contentId
            ? { content_ids: [opts.contentId], content_type: "product" }
            : {}),
          ...(opts.contentName ? { content_name: opts.contentName } : {}),
        },
      },
    ],
  };

  try {
    const apiVersion = process.env.META_CAPI_VERSION || "v21.0";
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${pixelId}/events?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      console.error("Meta CAPI Purchase failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Meta CAPI error:", err);
  }
}

/**
 * Custom event fired when someone actually *reads* a preview (30s+ of visible,
 * active time — not just a pageview).
 *
 * The point is optimisation, not reporting. A campaign optimised for link clicks
 * tells Meta to find people who tap; it has no idea whether they read, so it
 * keeps buying the cheapest taps available. Feeding this event back lets the
 * campaign be optimised for readers instead — the only lever that changes *who*
 * Meta sends.
 *
 * `fbp`/`fbc` are the pixel's own cookies; passing them is what lets Meta match
 * the event to the ad click that caused it.
 */
export async function sendMetaReadEvent(opts: {
  /** Shared dedup key — the browser pixel fires the same id. */
  eventId: string;
  contentId?: string | null;
  contentName?: string | null;
  /** Seconds of active reading, for reporting. */
  seconds?: number;
  eventSourceUrl?: string;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return; // not configured — no-op

  const userData: Record<string, unknown> = {};
  if (opts.clientIp) userData.client_ip_address = opts.clientIp;
  if (opts.userAgent) userData.client_user_agent = opts.userAgent;
  if (opts.fbp) userData.fbp = opts.fbp;
  if (opts.fbc) userData.fbc = opts.fbc;

  const payload = {
    data: [
      {
        event_name: META_READ_EVENT,
        event_time: Math.floor(Date.now() / 1000),
        event_id: opts.eventId,
        action_source: "website",
        ...(opts.eventSourceUrl ? { event_source_url: opts.eventSourceUrl } : {}),
        user_data: userData,
        custom_data: {
          ...(opts.contentId
            ? { content_ids: [opts.contentId], content_type: "product" }
            : {}),
          ...(opts.contentName ? { content_name: opts.contentName } : {}),
          ...(opts.seconds ? { read_seconds: opts.seconds } : {}),
        },
      },
    ],
  };

  try {
    const apiVersion = process.env.META_CAPI_VERSION || "v21.0";
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${pixelId}/events?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      console.error("Meta CAPI ReadEngaged failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Meta CAPI error:", err);
  }
}
