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
  if (path.startsWith("/lp/")) return "preview";
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
  scrollDepth: number;
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
