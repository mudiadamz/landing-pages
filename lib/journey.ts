"use client";

/**
 * Client helpers for first-party session/journey analytics. Fire-and-forget to
 * /api/analytics; best-effort, never throws into the UI. Reuses lib/track.ts for
 * device/referrer detection.
 */
import { referrerHost } from "@/lib/track";

const VISITOR_KEY = "lp-vid";
const ENTRY_KEY = "lp-entry";

const rid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Persistent, cross-session visitor id (localStorage) — spots returning visitors. */
export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = rid();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return rid();
  }
}

export type Utm = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
};

function parseUtm(search: string): Utm {
  const p = new URLSearchParams(search);
  const g = (k: string) => p.get(k) || undefined;
  return {
    source: g("utm_source"),
    medium: g("utm_medium"),
    campaign: g("utm_campaign"),
    term: g("utm_term"),
    content: g("utm_content"),
  };
}

export type JourneyEntry = {
  path: string;
  referrer: string | null;
  referrerHost: string | null;
  utm: Utm;
};

/** Entry snapshot captured once per session (landing path, referrer, UTM). */
export function getSessionEntry(): JourneyEntry {
  try {
    const raw = sessionStorage.getItem(ENTRY_KEY);
    if (raw) return JSON.parse(raw) as JourneyEntry;
  } catch {
    /* ignore */
  }
  const entry: JourneyEntry = {
    path: typeof location !== "undefined" ? location.pathname : "/",
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
    referrerHost: referrerHost(),
    utm: typeof location !== "undefined" ? parseUtm(location.search) : {},
  };
  try {
    sessionStorage.setItem(ENTRY_KEY, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
  return entry;
}

export function pageType(path: string): "home" | "preview" | "checkout" | "panel" | "other" {
  if (path === "/") return "home";
  // BOTH prefixes on purpose. The preview moved from /lp/ to /preview/, and
  // lp_page_events holds months of rows recorded under the old path — anything that
  // re-derives a type from a stored path (campaign reports, funnels) would classify
  // that history as "other" and quietly show a collapsed preview step.
  if (path.startsWith("/preview/") || path.startsWith("/lp/")) return "preview";
  if (path.startsWith("/checkout/")) return "checkout";
  if (path.startsWith("/panel")) return "panel";
  return "other";
}

export function productSlugFromPath(path: string): string | null {
  const m = path.match(/^\/(?:lp|checkout)\/([^/]+)/);
  try {
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return m ? m[1] : null;
  }
}

export type JourneyPayload = {
  sessionId: string;
  visitorId: string;
  entry: JourneyEntry;
  path: string;
  pageType: string;
  productSlug: string | null;
  dwellMs: number;
  /** null when the page never became scrollable — depth is unknown, not 0/100. */
  scrollDepth: number | null;
  reachedEnd: boolean;
  device: string;
  browser: string;
  os: string;
};

export function sendJourney(payload: JourneyPayload, beacon = false): void {
  try {
    const body = JSON.stringify(payload);
    if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Reports a genuine read to Meta (30s+ of active time on a preview), once per
 * product per session. Fires the browser pixel and the server CAPI with the
 * same event id so Meta dedupes them into one event.
 *
 * This is the signal a campaign can be optimised for — see /api/meta/read.
 */
const READ_SENT_KEY = "lp-read-sent";

export function reportEngagedRead(slug: string, seconds: number): void {
  try {
    const sent = new Set<string>(JSON.parse(sessionStorage.getItem(READ_SENT_KEY) || "[]"));
    if (sent.has(slug)) return;
    sent.add(slug);
    sessionStorage.setItem(READ_SENT_KEY, JSON.stringify([...sent]));

    const eventId = `read_${slug}_${getVisitorId()}_${Date.now()}`;

    // Browser pixel — deduped against the server event by eventID.
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (typeof fbq === "function") {
      fbq("trackCustom", "ReadEngaged", { content_name: slug, read_seconds: Math.round(seconds) }, { eventID: eventId });
    }

    void fetch("/api/meta/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, eventId, seconds: Math.round(seconds) }),
      keepalive: true,
    });
  } catch {
    /* best-effort */
  }
}
