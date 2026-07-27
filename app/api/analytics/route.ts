import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * First-party session/journey ingestion. One POST per page visit (sendBeacon or
 * fetch) from components/session-tracker.tsx. Resolves IP + geo + logged-in user
 * server-side (client never sends identity), upserts the session, and inserts a
 * page_event. Public + best-effort: always answers 204 so a beacon never errors.
 */

const PAGE_TYPES = new Set(["home", "preview", "checkout", "panel", "other"]);
const DEVICES = new Set(["mobile", "tablet", "desktop"]);

function clamp(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

function num(v: unknown, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), max);
}

/** First public IP from x-forwarded-for / x-real-ip; null for private/local. */
function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  const candidates = xff ? xff.split(",").map((s) => s.trim()) : [];
  const real = req.headers.get("x-real-ip");
  if (real) candidates.push(real.trim());
  for (const ip of candidates) {
    if (!ip) continue;
    if (/^(127\.|10\.|192\.168\.|::1|fe80:|fc00:|fd)/i.test(ip)) continue;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) continue;
    return ip.slice(0, 64);
  }
  return null;
}

/**
 * Excluded IPs change rarely but are checked on every event, so the list is held
 * in memory for a minute rather than queried each time.
 */
let ipDenyCache: { at: number; set: Set<string> } | null = null;
const IP_DENY_TTL_MS = 60_000;

async function isExcludedIp(
  admin: ReturnType<typeof createAdminClient>,
  ip: string,
): Promise<boolean> {
  try {
    if (!ipDenyCache || Date.now() - ipDenyCache.at > IP_DENY_TTL_MS) {
      const { data } = await admin.from("lp_excluded_ips").select("ip");
      ipDenyCache = { at: Date.now(), set: new Set((data ?? []).map((r) => r.ip as string)) };
    }
    return ipDenyCache.set.has(ip);
  } catch {
    return false; // never drop real traffic because a lookup failed
  }
}

type Geo = { country: string | null; region: string | null; city: string | null; isp: string | null };
const EMPTY_GEO: Geo = { country: null, region: null, city: null, isp: null };

/** Geo for an IP via the lp_ip_geo cache; on miss, ip-api.com (free, no key). */
async function lookupGeo(
  supabase: ReturnType<typeof createAdminClient>,
  ip: string,
): Promise<Geo> {
  try {
    const { data: cached } = await supabase
      .from("lp_ip_geo")
      .select("country, region, city, isp")
      .eq("ip", ip)
      .maybeSingle();
    if (cached) return cached as Geo;

    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp`,
      { signal: AbortSignal.timeout(2500) },
    );
    const j = (await res.json().catch(() => null)) as
      | { status?: string; country?: string; regionName?: string; city?: string; isp?: string }
      | null;
    const geo: Geo =
      j && j.status === "success"
        ? {
            country: j.country?.slice(0, 80) ?? null,
            region: j.regionName?.slice(0, 80) ?? null,
            city: j.city?.slice(0, 80) ?? null,
            isp: j.isp?.slice(0, 120) ?? null,
          }
        : EMPTY_GEO;
    await supabase.from("lp_ip_geo").upsert({ ip, ...geo }, { onConflict: "ip" });
    return geo;
  } catch {
    return EMPTY_GEO;
  }
}

/**
 * Preview engagement bucket from dwell + scroll depth. `scroll` is null when the
 * page never became scrollable (async readers), in which case we judge on dwell
 * alone rather than inventing a depth.
 */
function engagementOf(dwellMs: number, scroll: number | null, reachedEnd: boolean): string {
  const sec = dwellMs / 1000;
  if (scroll === null) {
    if (sec < 8) return "left";
    if (sec > 40) return "read";
    return "curious";
  }
  if (sec < 8 || scroll < 15) return "left";
  if (sec > 40 && (scroll > 60 || reachedEnd)) return "read";
  return "curious";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return new NextResponse(null, { status: 204 });

    const sessionId = clamp(body.sessionId, 80);
    const path = clamp(body.path, 400);
    if (!sessionId || !path) return new NextResponse(null, { status: 204 });

    const visitorId = clamp(body.visitorId, 80);
    const entry = (body.entry ?? {}) as Record<string, unknown>;
    const utm = (entry.utm ?? {}) as Record<string, unknown>;
    const kind = clamp(body.pageType, 20);
    const pageKind = kind && PAGE_TYPES.has(kind) ? kind : "other";
    const device = clamp(body.device, 20);
    const productSlug = clamp(body.productSlug, 200);

    const dwellMs = num(body.dwellMs, 6 * 60 * 60 * 1000); // cap 6h
    // null = unknown (page never scrollable); distinct from a real 0.
    const scrollDepth =
      body.scrollDepth === null || body.scrollDepth === undefined ? null : num(body.scrollDepth, 100);
    const reachedEnd = body.reachedEnd === true;
    const engagement = pageKind === "preview" ? engagementOf(dwellMs, scrollDepth, reachedEnd) : null;

    const admin = createAdminClient();

    // Identity resolved server-side from the auth cookie (never trusted from client).
    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      /* anon */
    }

    // Internal traffic (the team's own accounts) is dropped entirely rather
    // than recorded and filtered later, so every downstream number — sessions,
    // bounce, read rate — is clean by construction.
    if (userId) {
      const { data: prof } = await admin
        .from("lp_profiles")
        .select("exclude_from_stats")
        .eq("id", userId)
        .maybeSingle();
      if (prof?.exclude_from_stats) return new NextResponse(null, { status: 204 });
    }

    // Resolve product slug → id (for the FK / joins).
    let productId: string | null = null;
    if (productSlug) {
      const { data: prod } = await admin
        .from("lp_landing_pages")
        .select("id")
        .eq("slug", productSlug)
        .maybeSingle();
      productId = prod?.id ?? null;
    }

    // Entry data (only recorded on the session's first event).
    const landingPath = clamp(entry.path, 400) ?? path;
    const entrySlug =
      landingPath.match(/^\/(?:lp|checkout)\/([^/]+)/)?.[1] ?? null;
    let entryProductId: string | null = null;
    if (entrySlug) {
      if (entrySlug === productSlug) entryProductId = productId;
      else {
        const { data: ep } = await admin
          .from("lp_landing_pages")
          .select("id")
          .eq("slug", decodeURIComponent(entrySlug))
          .maybeSingle();
        entryProductId = ep?.id ?? null;
      }
    }

    // IP + geo (best-effort; never blocks the write on failure).
    const ip = clientIp(req);
    // Address-based exclusion — covers the owner browsing signed out, and
    // office/staff networks, which the per-user flag can't reach.
    if (ip && (await isExcludedIp(admin, ip))) return new NextResponse(null, { status: 204 });
    const geo = ip ? await lookupGeo(admin, ip) : EMPTY_GEO;

    await admin.rpc("lp_track_session", {
      p_session_id: sessionId,
      p_visitor_id: visitorId,
      p_user_id: userId,
      p_ip: ip,
      p_country: geo.country,
      p_region: geo.region,
      p_city: geo.city,
      p_isp: geo.isp,
      p_referrer: clamp(entry.referrer, 500),
      p_referrer_host: clamp(entry.referrerHost, 255),
      p_landing_path: landingPath,
      p_entry_product_id: entryProductId,
      p_utm_source: clamp(utm.source, 120),
      p_utm_medium: clamp(utm.medium, 120),
      p_utm_campaign: clamp(utm.campaign, 160),
      p_utm_term: clamp(utm.term, 160),
      p_utm_content: clamp(utm.content, 160),
      p_device: device && DEVICES.has(device) ? device : null,
      p_browser: clamp(body.browser, 40),
      p_os: clamp(body.os, 40),
      p_dwell_ms: dwellMs,
    });

    await admin.from("lp_page_events").insert({
      session_id: sessionId,
      visitor_id: visitorId,
      user_id: userId,
      path,
      product_id: productId,
      product_slug: productSlug,
      page_type: pageKind,
      referrer_host: clamp(entry.referrerHost, 255),
      dwell_ms: dwellMs,
      scroll_depth: scrollDepth,
      reached_end: reachedEnd,
      engagement,
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
