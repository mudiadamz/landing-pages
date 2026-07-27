/**
 * Client-side product analytics helpers. Fire-and-forget POSTs to /api/track;
 * the server resolves the slug → product and stores the event. Everything here
 * is best-effort and must never throw into the UI.
 */

export type TrackPage = "preview" | "checkout";

export type TrackPayload = {
  slug: string;
  sessionId: string;
  kind: "view" | "session" | "cta";
  page: TrackPage;
  referrerHost?: string | null;
  device?: string;
  browser?: string;
  os?: string;
  durationMs?: number;
  ctaAction?: string;
};

/** Stable per-tab-session id, shared across the preview → checkout journey. */
export function getSessionId(): string {
  try {
    const k = "lp-sid";
    let id = sessionStorage.getItem(k);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(k, id);
    }
    return id;
  } catch {
    // Storage blocked (private mode) — a per-call id still lets events land.
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Coarse device / browser / OS from the UA string. */
export function detectClient(): { device: string; browser: string; os: string } {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

  // In-app browsers first: they're the majority of ad traffic and they lie about
  // the rest. Instagram's Android webview omits the "Mobile" token, so the old
  // "Android without Mobile = tablet" rule filed most of a campaign's phones as
  // tablets — which made every device segment in the analytics wrong.
  const inApp =
    /FBAN|FBAV|FB_IAB/i.test(ua)
      ? "Facebook app"
      : /Instagram/i.test(ua)
        ? "Instagram app"
        : /\bLine\//i.test(ua)
          ? "LINE app"
          : /TikTok|musical_ly/i.test(ua)
            ? "TikTok app"
            : /Twitter/i.test(ua)
              ? "X app"
              : null;

  // Only call it a tablet on positive evidence, never on a missing token.
  const isTablet =
    /iPad/i.test(ua) ||
    /\bTablet\b|PlayBook|Silk/i.test(ua) ||
    /\bSM-T|\bGT-P|Nexus (?:7|9|10)\b/i.test(ua);
  const isMobile = /Mobi|Android|iPhone|iPod|IEMobile|Opera Mini/i.test(ua) || !!inApp;
  const device = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  let browser = "Lainnya";
  if (inApp) browser = inApp;
  else if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let os = "Lainnya";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return { device, browser, os };
}

/** External referrer host, or null for direct / same-site navigation. */
export function referrerHost(): string | null {
  try {
    const r = document.referrer;
    if (!r) return null;
    const u = new URL(r);
    if (u.host === location.host) return null;
    return u.host;
  } catch {
    return null;
  }
}

/** Send an event. Uses sendBeacon when possible (survives page unload). */
export function sendTrack(payload: TrackPayload, beacon = false): void {
  try {
    const body = JSON.stringify(payload);
    if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never throw */
  }
}

/** Convenience for CTA clicks (buy, share, add-to-home, etc.). */
export function trackCta(slug: string, page: TrackPage, action: string): void {
  const { device, browser, os } = detectClient();
  sendTrack(
    {
      slug,
      sessionId: getSessionId(),
      kind: "cta",
      page,
      ctaAction: action,
      device,
      browser,
      os,
    },
    true,
  );
}
