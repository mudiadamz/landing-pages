"use server";

import { createClient } from "@/lib/supabase/server";

export type Bucket = { key: string; count: number };

export type ProductStats = {
  sinceDays: number;
  totalViews: number;
  sessions: number;
  avgSessionSec: number;
  previewViews: number;
  checkoutViews: number;
  /** Distinct sessions that opened a preview — the denominator for scrollRate. */
  previewSessions: number;
  /** Of those, how many scrolled the reader at least once. */
  scrollSessions: number;
  /** 0..1. Low = the first screen isn't read as scrollable; see trackFirstScroll. */
  scrollRate: number;
  /** Median ms from "text visible" to first scroll, over sessions that scrolled. */
  medianFirstScrollMs: number;
  devices: Bucket[];
  browsers: Bucket[];
  os: Bucket[];
  referrers: Bucket[];
  ctas: Bucket[];
  daily: { date: string; views: number }[];
  /** Views per hour (index 0–23) for the viewer's local "today". */
  hourlyToday: number[];
  todayViews: number;
  capped: boolean;
};

type EventRow = {
  session_id: string | null;
  kind: string;
  page: string | null;
  referrer_host: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  duration_ms: number | null;
  cta_action: string | null;
  created_at: string;
};

const MAX_ROWS = 20000;

function topBuckets(counts: Map<string, number>, limit = 8): Bucket[] {
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Aggregated visitor analytics for one product over the last `days`. RLS scopes
 * the read to the product's owner, so this returns null if the caller doesn't
 * own the product (or it doesn't exist).
 */
export async function getProductStats(
  pageId: string,
  days = 30,
  // Minutes east of UTC for the viewer's local day (WIB = +420). Used to bucket
  // "today"/hourly and daily by the viewer's wall clock rather than UTC.
  tzOffsetMinutes = 420,
): Promise<ProductStats | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Confirm ownership up front (also blocks a valid-but-not-yours id).
  const { data: owned } = await supabase
    .from("lp_landing_pages")
    .select("id")
    .eq("id", pageId)
    .eq("user_id", user.id)
    .single();
  if (!owned) return null;

  const sinceDays = [7, 30, 90].includes(days) ? days : 30;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("lp_product_events")
    .select("session_id, kind, page, referrer_host, device, browser, os, duration_ms, cta_action, created_at")
    .eq("landing_page_id", pageId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error) return null;
  const rows = (data ?? []) as EventRow[];

  const devices = new Map<string, number>();
  const browsers = new Map<string, number>();
  const os = new Map<string, number>();
  const referrers = new Map<string, number>();
  const ctas = new Map<string, number>();
  const sessions = new Set<string>();
  const dailyMap = new Map<string, number>();
  const durationBySession = new Map<string, number>();
  // First-scroll telemetry, deduped by session (the client fires once, but a
  // beacon retry or a second tab would otherwise double-count).
  const previewSessionIds = new Set<string>();
  const firstScrollBySession = new Map<string, number>();

  let totalViews = 0;
  let previewViews = 0;
  let checkoutViews = 0;

  // Local-day bucketing: shift the UTC instant by the viewer's offset, then read
  // the shifted value with getUTC* to get their wall-clock day/hour.
  const tz = Number.isFinite(tzOffsetMinutes)
    ? Math.max(-840, Math.min(840, tzOffsetMinutes))
    : 420;
  const dayMs = 24 * 60 * 60 * 1000;
  const nowLocalMs = Date.now() + tz * 60000;
  const todayKey = new Date(nowLocalMs).toISOString().slice(0, 10);
  const hourlyToday = new Array<number>(24).fill(0);
  let todayViews = 0;

  const bump = (m: Map<string, number>, key: string | null, fallback: string) =>
    m.set(key || fallback, (m.get(key || fallback) ?? 0) + 1);

  for (const r of rows) {
    if (r.session_id) sessions.add(r.session_id);

    if (r.kind === "view") {
      totalViews++;
      if (r.page === "checkout") checkoutViews++;
      else {
        previewViews++;
        if (r.session_id) previewSessionIds.add(r.session_id);
      }
      bump(devices, r.device, "Lainnya");
      bump(browsers, r.browser, "Lainnya");
      bump(os, r.os, "Lainnya");
      bump(referrers, r.referrer_host, "Langsung");
      const local = new Date(new Date(r.created_at).getTime() + tz * 60000);
      const day = local.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
      if (day === todayKey) {
        hourlyToday[local.getUTCHours()]++;
        todayViews++;
      }
    } else if (r.kind === "session" && r.session_id && r.duration_ms) {
      durationBySession.set(
        r.session_id,
        (durationBySession.get(r.session_id) ?? 0) + r.duration_ms,
      );
    } else if (r.kind === "scroll" && r.session_id) {
      // Rows arrive newest-first, so keep the earliest reading for a session.
      firstScrollBySession.set(r.session_id, r.duration_ms ?? 0);
    } else if (r.kind === "cta") {
      bump(ctas, r.cta_action, "lainnya");
    }
  }

  const durations = [...durationBySession.values()];
  const avgSessionSec = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000)
    : 0;

  // Median, not mean: one visitor who left the tab open skews an average badly.
  const scrollTimes = [...firstScrollBySession.values()].sort((a, b) => a - b);
  const medianFirstScrollMs = scrollTimes.length
    ? scrollTimes.length % 2
      ? scrollTimes[(scrollTimes.length - 1) / 2]
      : Math.round((scrollTimes[scrollTimes.length / 2 - 1] + scrollTimes[scrollTimes.length / 2]) / 2)
    : 0;
  // Only sessions we actually saw open a preview can be scored on scrolling.
  const scrollSessions = [...firstScrollBySession.keys()].filter((id) =>
    previewSessionIds.has(id),
  ).length;
  const previewSessions = previewSessionIds.size;

  // Last `sinceDays` days as a dense series (fill gaps with 0), in local days.
  const daily: { date: string; views: number }[] = [];
  for (let i = sinceDays - 1; i >= 0; i--) {
    const d = new Date(nowLocalMs - i * dayMs).toISOString().slice(0, 10);
    daily.push({ date: d, views: dailyMap.get(d) ?? 0 });
  }

  return {
    sinceDays,
    totalViews,
    sessions: sessions.size,
    avgSessionSec,
    previewViews,
    checkoutViews,
    previewSessions,
    scrollSessions,
    scrollRate: previewSessions ? scrollSessions / previewSessions : 0,
    medianFirstScrollMs,
    devices: topBuckets(devices),
    browsers: topBuckets(browsers),
    os: topBuckets(os),
    referrers: topBuckets(referrers),
    ctas: topBuckets(ctas),
    daily,
    hourlyToday,
    todayViews,
    capped: rows.length >= MAX_ROWS,
  };
}
