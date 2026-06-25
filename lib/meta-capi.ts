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
