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
  devices: Bucket[];
  browsers: Bucket[];
  os: Bucket[];
  referrers: Bucket[];
  ctas: Bucket[];
  daily: { date: string; views: number }[];
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

  let totalViews = 0;
  let previewViews = 0;
  let checkoutViews = 0;

  const bump = (m: Map<string, number>, key: string | null, fallback: string) =>
    m.set(key || fallback, (m.get(key || fallback) ?? 0) + 1);

  for (const r of rows) {
    if (r.session_id) sessions.add(r.session_id);

    if (r.kind === "view") {
      totalViews++;
      if (r.page === "checkout") checkoutViews++;
      else previewViews++;
      bump(devices, r.device, "Lainnya");
      bump(browsers, r.browser, "Lainnya");
      bump(os, r.os, "Lainnya");
      bump(referrers, r.referrer_host, "Langsung");
      const day = r.created_at.slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    } else if (r.kind === "session" && r.session_id && r.duration_ms) {
      durationBySession.set(
        r.session_id,
        (durationBySession.get(r.session_id) ?? 0) + r.duration_ms,
      );
    } else if (r.kind === "cta") {
      bump(ctas, r.cta_action, "lainnya");
    }
  }

  const durations = [...durationBySession.values()];
  const avgSessionSec = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000)
    : 0;

  // Last `sinceDays` days as a dense series (fill gaps with 0).
  const daily: { date: string; views: number }[] = [];
  for (let i = sinceDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    daily.push({ date: d, views: dailyMap.get(d) ?? 0 });
  }

  return {
    sinceDays,
    totalViews,
    sessions: sessions.size,
    avgSessionSec,
    previewViews,
    checkoutViews,
    devices: topBuckets(devices),
    browsers: topBuckets(browsers),
    os: topBuckets(os),
    referrers: topBuckets(referrers),
    ctas: topBuckets(ctas),
    daily,
    capped: rows.length >= MAX_ROWS,
  };
}
