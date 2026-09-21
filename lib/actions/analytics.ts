"use server";

import { createAdminClient } from "@/lib/db/admin";
import { fetchAllRows } from "@/lib/paginate";
import { requireAdmin } from "@/lib/actions/profiles";
import { panelScope } from "@/lib/site-scope";

/**
 * Read-side aggregation for the session/journey analytics dashboard. Admin-only.
 * Pulls sessions + page_events within the range and aggregates in JS (the seller
 * volume is small); heavy tables are capped with .limit().
 */

export type Range = 7 | 30 | 90;

const CAP_SESSIONS = 8000;
const CAP_EVENTS = 40000;

function sinceIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

type SessionRow = {
  session_id: string;
  visitor_id: string | null;
  user_id: string | null;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  referrer: string | null;
  referrer_host: string | null;
  landing_path: string | null;
  entry_product_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  pageviews: number;
  active_ms: number;
  started_at: string;
  last_seen_at: string;
};

type EventRow = {
  session_id: string;
  path: string;
  product_slug: string | null;
  page_type: string | null;
  dwell_ms: number;
  scroll_depth: number | null;
  reached_end: boolean;
  engagement: string | null;
  created_at: string;
};

export type Overview = {
  sessions: number;
  visitors: number;
  loggedIn: number;
  anon: number;
  avgDurationMs: number;
  pageviews: number;
};

export type CampaignRow = {
  key: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  previews: number;
  checkouts: number;
  convRate: number; // checkouts / previews
};

export type ReferrerRow = { host: string; sessions: number; checkouts: number };
export type GeoRow = { country: string; city: string | null; sessions: number };
export type EntryRow = { path: string; title: string | null; sessions: number };
export type EngagementRow = {
  slug: string;
  title: string | null;
  read: number;
  curious: number;
  left: number;
  total: number;
  avgDwellMs: number;
  avgScroll: number;
};

export type SessionListRow = {
  sessionId: string;
  name: string | null;
  email: string | null;
  anon: boolean;
  ip: string | null;
  country: string | null;
  city: string | null;
  isp: string | null;
  referrerHost: string | null;
  campaign: string | null;
  source: string | null;
  landingPath: string | null;
  entryTitle: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  startedAt: string;
  durationMs: number;
  pageviews: number;
};

export type Analytics = {
  /** Hit the row ceiling — the numbers below describe a slice, not everything. */
  capped?: boolean;
  ok: boolean;
  range: Range;
  overview: Overview;
  campaigns: CampaignRow[];
  referrers: ReferrerRow[];
  geography: GeoRow[];
  entryPoints: EntryRow[];
  engagement: EngagementRow[];
  sessions: SessionListRow[];
};

const EMPTY: Analytics = {
  ok: false,
  capped: false,
  range: 30,
  overview: { sessions: 0, visitors: 0, loggedIn: 0, anon: 0, avgDurationMs: 0, pageviews: 0 },
  campaigns: [],
  referrers: [],
  geography: [],
  entryPoints: [],
  engagement: [],
  sessions: [],
};

/**
 * A match-everything `.or()`, used when there is nothing to scope by (a single-domain
 * deployment). Spelled out rather than branching the two query builders, which are
 * already three levels of callback deep — "site_id is null OR it isn't" is total.
 */
const ALL_SITES = "site_id.is.null,site_id.not.is.null";

export async function getAnalytics(range: Range = 30): Promise<Analytics> {
  if (!(await requireAdmin())) return { ...EMPTY, range };

  const admin = createAdminClient();
  const since = sinceIso(range);
  // Only the storefront the sidebar switcher points at. Rows written before
  // attribution existed are NULL and count with the canonical site — see lib/site-scope.
  const { filter: scope } = await panelScope();

  // Paged, not .limit()ed — PostgREST caps a single response at max_rows (1000
  // here) no matter what limit is asked for, so the old query reported 1000
  // sessions forever and every number below it was computed from that slice.
  // `id` is the tiebreaker that keeps paging stable across equal timestamps.
  const [sessRes, evRes, { data: prodRaw }] = await Promise.all([
    fetchAllRows<SessionRow>(
      (from, to) =>
        admin
          .from("lp_sessions")
          .select(
            "session_id, visitor_id, user_id, ip, country, region, city, isp, referrer, referrer_host, landing_path, entry_product_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, device, browser, os, pageviews, active_ms, started_at, last_seen_at",
          )
          .gte("started_at", since)
          .order("started_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to)
          .or(scope?.or ?? ALL_SITES),
      CAP_SESSIONS,
    ),
    fetchAllRows<EventRow>(
      (from, to) =>
        admin
          .from("lp_page_events")
          .select("session_id, path, product_slug, page_type, dwell_ms, scroll_depth, reached_end, engagement, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
          .or(scope?.or ?? ALL_SITES),
      CAP_EVENTS,
    ),
    admin.from("lp_landing_pages").select("slug, title"),
  ]);

  const sessions = sessRes.rows;
  const events = evRes.rows;
  const capped = sessRes.capped || evRes.capped;
  const titleBySlug = new Map<string, string>();
  for (const p of (prodRaw ?? []) as { slug: string; title: string }[]) titleBySlug.set(p.slug, p.title);

  // Emails / names for logged-in visitors.
  const userIds = [...new Set(sessions.map((s) => s.user_id).filter(Boolean) as string[])];
  const emailById = new Map<string, string>();
  const nameById = new Map<string, string>();
  if (userIds.length) {
    // Email from lp_profiles, not auth.admin.listUsers: that listed every
    // account in the project to find a few, stopped silently at the 1001st,
    // and was one more GoTrue admin call for any future backend to reproduce.
    // lp_handle_new_user copies the address into the profile at signup, and the
    // app has no e-mail-change flow that could make the two drift.
    const { data: profs } = await admin.from("lp_profiles").select("id, full_name, email").in("id", userIds);
    for (const p of (profs ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      if (p.full_name) nameById.set(p.id, p.full_name);
      if (p.email) emailById.set(p.id, p.email);
    }
  }

  // Per-session derived flags from events.
  const hasPreview = new Set<string>();
  const hasCheckout = new Set<string>();
  for (const e of events) {
    if (e.page_type === "preview") hasPreview.add(e.session_id);
    if (e.page_type === "checkout") hasCheckout.add(e.session_id);
  }

  // Overview.
  const visitors = new Set(sessions.map((s) => s.visitor_id ?? s.session_id)).size;
  const loggedIn = sessions.filter((s) => s.user_id).length;
  const totalDur = sessions.reduce((a, s) => a + (s.active_ms || 0), 0);
  const overview: Overview = {
    sessions: sessions.length,
    visitors,
    loggedIn,
    anon: sessions.length - loggedIn,
    avgDurationMs: sessions.length ? Math.round(totalDur / sessions.length) : 0,
    pageviews: sessions.reduce((a, s) => a + (s.pageviews || 0), 0),
  };

  // Acquisition — group by UTM (campaign/source/medium), with preview→checkout conv.
  const campMap = new Map<string, CampaignRow>();
  for (const s of sessions) {
    const source = s.utm_source;
    const medium = s.utm_medium;
    const campaign = s.utm_campaign;
    if (!source && !medium && !campaign) continue; // only ad/tagged traffic
    const key = `${source ?? ""}|${medium ?? ""}|${campaign ?? ""}`;
    let row = campMap.get(key);
    if (!row) {
      row = { key, source, medium, campaign, sessions: 0, previews: 0, checkouts: 0, convRate: 0 };
      campMap.set(key, row);
    }
    row.sessions++;
    if (hasPreview.has(s.session_id)) row.previews++;
    if (hasCheckout.has(s.session_id)) row.checkouts++;
  }
  const campaigns = [...campMap.values()]
    .map((r) => ({ ...r, convRate: r.previews ? r.checkouts / r.previews : 0 }))
    .sort((a, b) => b.sessions - a.sessions);

  // Referrers (external hosts).
  const refMap = new Map<string, ReferrerRow>();
  for (const s of sessions) {
    const host = s.referrer_host;
    if (!host) continue;
    let row = refMap.get(host);
    if (!row) {
      row = { host, sessions: 0, checkouts: 0 };
      refMap.set(host, row);
    }
    row.sessions++;
    if (hasCheckout.has(s.session_id)) row.checkouts++;
  }
  const referrers = [...refMap.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 40);

  // Geography.
  const geoMap = new Map<string, GeoRow>();
  for (const s of sessions) {
    if (!s.country) continue;
    const key = `${s.country}|${s.city ?? ""}`;
    let row = geoMap.get(key);
    if (!row) {
      row = { country: s.country, city: s.city, sessions: 0 };
      geoMap.set(key, row);
    }
    row.sessions++;
  }
  const geography = [...geoMap.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 60);

  // Entry points (landing path).
  const entryMap = new Map<string, EntryRow>();
  for (const s of sessions) {
    const path = s.landing_path || "/";
    let row = entryMap.get(path);
    if (!row) {
      const slug = path.match(/^\/(?:lp|checkout)\/([^/]+)/)?.[1];
      const title = slug ? titleBySlug.get(decodeURIComponent(slug)) ?? null : null;
      row = { path, title, sessions: 0 };
      entryMap.set(path, row);
    }
    row.sessions++;
  }
  const entryPoints = [...entryMap.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 40);

  // Preview engagement per product.
  type EngAgg = { read: number; curious: number; left: number; dwell: number; scroll: number; scrollN: number; n: number };
  const engMap = new Map<string, EngAgg>();
  for (const e of events) {
    if (e.page_type !== "preview" || !e.product_slug) continue;
    let agg = engMap.get(e.product_slug);
    if (!agg) {
      agg = { read: 0, curious: 0, left: 0, dwell: 0, scroll: 0, scrollN: 0, n: 0 };
      engMap.set(e.product_slug, agg);
    }
    if (e.engagement === "read") agg.read++;
    else if (e.engagement === "curious") agg.curious++;
    else agg.left++;
    agg.dwell += e.dwell_ms || 0;
    if (e.scroll_depth !== null) {
      agg.scroll += e.scroll_depth;
      agg.scrollN++;
    }
    agg.n++;
  }
  const engagement: EngagementRow[] = [...engMap.entries()]
    .map(([slug, a]) => ({
      slug,
      title: titleBySlug.get(slug) ?? null,
      read: a.read,
      curious: a.curious,
      left: a.left,
      total: a.n,
      avgDwellMs: a.n ? Math.round(a.dwell / a.n) : 0,
      avgScroll: a.scrollN ? Math.round(a.scroll / a.scrollN) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Sessions list.
  const sessionList: SessionListRow[] = sessions.map((s) => {
    const slug = s.landing_path?.match(/^\/(?:lp|checkout)\/([^/]+)/)?.[1];
    const entryTitle = slug ? titleBySlug.get(decodeURIComponent(slug)) ?? null : null;
    return {
      sessionId: s.session_id,
      name: s.user_id ? nameById.get(s.user_id) ?? null : null,
      email: s.user_id ? emailById.get(s.user_id) ?? null : null,
      anon: !s.user_id,
      ip: s.ip,
      country: s.country,
      city: s.city,
      isp: s.isp,
      referrerHost: s.referrer_host,
      campaign: s.utm_campaign,
      source: s.utm_source,
      landingPath: s.landing_path,
      entryTitle,
      device: s.device,
      browser: s.browser,
      os: s.os,
      startedAt: s.started_at,
      durationMs: s.active_ms || 0,
      pageviews: s.pageviews || 0,
    };
  });

  return {
    ok: true,
    capped,
    range,
    overview,
    campaigns,
    referrers,
    geography,
    entryPoints,
    engagement,
    sessions: sessionList,
  };
}

export type JourneyStep = {
  path: string;
  pageType: string | null;
  productSlug: string | null;
  title: string | null;
  dwellMs: number;
  scrollDepth: number | null;
  reachedEnd: boolean;
  engagement: string | null;
  createdAt: string;
};

/** Ordered page-by-page journey for one session (lazy-loaded on expand). */
export async function getSessionJourney(sessionId: string): Promise<JourneyStep[]> {
  if (!(await requireAdmin())) return [];
  if (!sessionId) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_page_events")
    .select("path, product_slug, page_type, dwell_ms, scroll_depth, reached_end, engagement, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(500);

  const slugs = [...new Set(((data ?? []) as EventRow[]).map((e) => e.product_slug).filter(Boolean) as string[])];
  const titleBySlug = new Map<string, string>();
  if (slugs.length) {
    const { data: prods } = await admin.from("lp_landing_pages").select("slug, title").in("slug", slugs);
    for (const p of (prods ?? []) as { slug: string; title: string }[]) titleBySlug.set(p.slug, p.title);
  }

  return ((data ?? []) as EventRow[]).map((e) => ({
    path: e.path,
    pageType: e.page_type,
    productSlug: e.product_slug,
    title: e.product_slug ? titleBySlug.get(e.product_slug) ?? null : null,
    dwellMs: e.dwell_ms || 0,
    scrollDepth: e.scroll_depth,
    reachedEnd: e.reached_end,
    engagement: e.engagement,
    createdAt: e.created_at,
  }));
}
