"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions/profiles";

/**
 * Behaviour-derived per-product summaries: turns raw session/journey events into
 * judgments — interest, intent, conversion, a health grade, and plain-language
 * insights. Reads lp_page_events (service-role) so it's admin-only for the
 * cross-product leaderboard; the single-product card also allows the owner.
 */

export type Range = 7 | 30 | 90;

export type Light = "green" | "yellow" | "red" | "gray";
export type Stage = "ignored" | "no-interest" | "no-conversion" | "converting";

export type ProductSummary = {
  id: string | null;
  slug: string;
  title: string;
  previews: number;
  visitors: number;
  read: number;
  curious: number;
  left: number;
  interestRate: number; // (read+curious)/previews
  readRate: number; // read/previews
  bounceRate: number; // left/previews
  medianDwellMs: number;
  avgScroll: number;
  reachedEndPct: number;
  sessionsWithPreview: number;
  sessionsWithCheckout: number;
  toCheckoutRate: number; // checkout sessions / preview sessions
  purchases: number;
  revenue: number;
  cvr: number; // purchases / preview sessions
  checkoutToPurchase: number;
  repeatViewers: number;
  bestSource: { name: string; readRate: number; previews: number } | null;
  trendPct: number; // preview change vs previous equal window (-1..∞), 0 if n/a
  interestScore: number;
  intentScore: number;
  conversionScore: number;
  grade: string | null; // A–F, or null if too little data
  stage: Stage;
  funnel: { reach: Light; interest: Light; intent: Light; convert: Light };
  insights: string[];
};

const CAP_EVENTS = 60000;

function sinceIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

const pct = (n: number) => Math.round(n * 100);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

type EventRow = {
  session_id: string;
  visitor_id: string | null;
  product_slug: string | null;
  page_type: string | null;
  dwell_ms: number;
  scroll_depth: number | null;
  reached_end: boolean;
  engagement: string | null;
  created_at: string;
};

type SourceMeta = { source: string | null; referrerHost: string | null; device: string | null };

type ProductMeta = { id: string; slug: string; title: string };

/**
 * Pure aggregation. `events` covers current + previous windows (for trend);
 * `boundaryIso` splits them. `sourceBySession` maps a session to its acquisition
 * source/device. `purchaseByProduct` is keyed by product id.
 */
function summarize(
  products: ProductMeta[],
  events: EventRow[],
  boundaryIso: string,
  sourceBySession: Map<string, SourceMeta>,
  purchaseByProduct: Map<string, { count: number; revenue: number }>,
): ProductSummary[] {
  const bySlug = new Map<string, ProductMeta>();
  for (const p of products) bySlug.set(p.slug, p);

  // Group events per slug, split current vs previous window.
  type Bucket = {
    curPreview: EventRow[];
    prevPreviewCount: number;
    curCheckoutSessions: Set<string>;
  };
  const buckets = new Map<string, Bucket>();
  const bucket = (slug: string) => {
    let b = buckets.get(slug);
    if (!b) {
      b = { curPreview: [], prevPreviewCount: 0, curCheckoutSessions: new Set() };
      buckets.set(slug, b);
    }
    return b;
  };

  for (const e of events) {
    if (!e.product_slug) continue;
    const cur = e.created_at >= boundaryIso;
    if (e.page_type === "preview") {
      if (cur) bucket(e.product_slug).curPreview.push(e);
      else bucket(e.product_slug).prevPreviewCount++;
    } else if (e.page_type === "checkout" && cur) {
      bucket(e.product_slug).curCheckoutSessions.add(e.session_id);
    }
  }

  const summaries: ProductSummary[] = [];

  for (const [slug, b] of buckets) {
    const meta = bySlug.get(slug);
    const previewsRows = b.curPreview;
    const previews = previewsRows.length;

    const visitors = new Set(previewsRows.map((e) => e.visitor_id ?? e.session_id));
    const previewSessions = new Set(previewsRows.map((e) => e.session_id));

    let read = 0;
    let curious = 0;
    let left = 0;
    let scrollSum = 0;
    let scrollN = 0;
    let reachedEnd = 0;
    const dwells: number[] = [];
    const perVisitor = new Map<string, number>();
    const sourceAgg = new Map<string, { previews: number; read: number }>();
    const deviceAgg = new Map<string, { previews: number; read: number }>();

    for (const e of previewsRows) {
      if (e.engagement === "read") read++;
      else if (e.engagement === "curious") curious++;
      else left++;
      if (e.scroll_depth !== null) {
        scrollSum += e.scroll_depth;
        scrollN++;
      }
      if (e.reached_end) reachedEnd++;
      dwells.push(e.dwell_ms || 0);

      const vid = e.visitor_id ?? e.session_id;
      perVisitor.set(vid, (perVisitor.get(vid) ?? 0) + 1);

      const meta2 = sourceBySession.get(e.session_id);
      const srcName = meta2?.source || meta2?.referrerHost || "Langsung";
      const sa = sourceAgg.get(srcName) ?? { previews: 0, read: 0 };
      sa.previews++;
      if (e.engagement === "read") sa.read++;
      sourceAgg.set(srcName, sa);

      if (meta2?.device) {
        const da = deviceAgg.get(meta2.device) ?? { previews: 0, read: 0 };
        da.previews++;
        if (e.engagement === "read") da.read++;
        deviceAgg.set(meta2.device, da);
      }
    }

    const interestRate = previews ? (read + curious) / previews : 0;
    const readRate = previews ? read / previews : 0;
    const bounceRate = previews ? left / previews : 0;
    const medianDwellMs = median(dwells);
    const avgScroll = scrollN ? Math.round(scrollSum / scrollN) : 0;
    const reachedEndPct = previews ? pct(reachedEnd / previews) : 0;

    const sessionsWithPreview = previewSessions.size;
    const sessionsWithCheckout = b.curCheckoutSessions.size;
    const toCheckoutRate = sessionsWithPreview ? sessionsWithCheckout / sessionsWithPreview : 0;

    const pur = (meta && purchaseByProduct.get(meta.id)) || { count: 0, revenue: 0 };
    const purchases = pur.count;
    const revenue = pur.revenue;
    const cvr = sessionsWithPreview ? clamp01(purchases / sessionsWithPreview) : 0;
    const checkoutToPurchase = sessionsWithCheckout ? clamp01(purchases / sessionsWithCheckout) : 0;

    let repeatViewers = 0;
    for (const c of perVisitor.values()) if (c >= 2) repeatViewers++;

    let bestSource: ProductSummary["bestSource"] = null;
    for (const [name, a] of sourceAgg) {
      if (a.previews < 3) continue;
      const rr = a.read / a.previews;
      if (!bestSource || rr > bestSource.readRate) bestSource = { name, readRate: rr, previews: a.previews };
    }

    const trendPct = b.prevPreviewCount > 0 ? previews / b.prevPreviewCount - 1 : previews > 0 ? 1 : 0;

    // Scores (0–100).
    const dwellScore = clamp01(medianDwellMs / 90000); // 90s = full
    const interestScore = Math.round(100 * (0.55 * readRate + 0.25 * interestRate + 0.2 * dwellScore));
    const repeatRate = visitors.size ? repeatViewers / visitors.size : 0;
    const intentScore = Math.round(100 * (0.7 * clamp01(toCheckoutRate / 0.15) + 0.3 * clamp01(repeatRate / 0.25)));
    const conversionScore = Math.round(100 * (0.6 * clamp01(cvr / 0.08) + 0.4 * checkoutToPurchase));

    const overall = 0.4 * interestScore + 0.3 * intentScore + 0.3 * conversionScore;
    const grade =
      previews < 5
        ? null
        : overall >= 78
          ? "A"
          : overall >= 62
            ? "B"
            : overall >= 46
              ? "C"
              : overall >= 30
                ? "D"
                : "F";

    // Stage diagnosis.
    let stage: Stage;
    if (previews === 0) stage = "ignored";
    else if (purchases > 0 && cvr >= 0.015) stage = "converting";
    else if (bounceRate > 0.6 && readRate < 0.15) stage = "no-interest";
    else if (interestRate >= 0.25 || readRate >= 0.15) stage = "no-conversion";
    else stage = "no-interest";

    const funnel = {
      reach: (previews >= 20 ? "green" : previews >= 5 ? "yellow" : previews >= 1 ? "red" : "gray") as Light,
      interest: (previews === 0
        ? "gray"
        : readRate >= 0.3
          ? "green"
          : readRate >= 0.12
            ? "yellow"
            : "red") as Light,
      intent: (sessionsWithPreview === 0
        ? "gray"
        : toCheckoutRate >= 0.1
          ? "green"
          : toCheckoutRate >= 0.03
            ? "yellow"
            : "red") as Light,
      convert: (sessionsWithCheckout === 0 && purchases === 0
        ? "gray"
        : cvr >= 0.05
          ? "green"
          : cvr >= 0.015
            ? "yellow"
            : "red") as Light,
    };

    // Insights (Indonesian; pick the most useful, cap at 3).
    const insights: string[] = [];
    if (previews >= 5 && bounceRate > 0.5)
      insights.push(`${pct(bounceRate)}% pengunjung pergi <8 detik — layar pertama preview belum menarik.`);
    if (readRate >= 0.2 && purchases === 0 && sessionsWithPreview >= 5)
      insights.push(`Banyak yang membaca (${pct(readRate)}%) tapi belum ada yang beli — kemungkinan harga/kepercayaan, bukan minat.`);
    if (stage === "converting")
      insights.push(`Konversi sehat (${(cvr * 100).toFixed(1)}%) — produk ini layak ditambah trafik/iklan.`);
    if (repeatViewers >= 3)
      insights.push(`${repeatViewers} pengunjung balik lagi ke preview ini tanpa beli — kandidat retargeting.`);
    if (bestSource && sourceAgg.size >= 2)
      insights.push(`Trafik terbaik: ${bestSource.name} (baca ${pct(bestSource.readRate)}%).`);
    // Device skew.
    if (deviceAgg.size >= 2) {
      const ds = [...deviceAgg.entries()]
        .filter(([, a]) => a.previews >= 3)
        .map(([d, a]) => ({ d, rr: a.read / a.previews }));
      if (ds.length >= 2) {
        ds.sort((a, b2) => b2.rr - a.rr);
        const top = ds[0];
        const bot = ds[ds.length - 1];
        if (top.rr - bot.rr >= 0.2)
          insights.push(`Kuat di ${top.d} (baca ${pct(top.rr)}%) vs ${bot.d} (baca ${pct(bot.rr)}%) — cek tampilan ${bot.d}.`);
      }
    }
    if (trendPct >= 0.5 && previews >= 5)
      insights.push(`Views naik ${Math.round((trendPct + 1) * 10) / 10}× dibanding periode sebelumnya.`);
    else if (trendPct <= -0.4 && b.prevPreviewCount >= 5)
      insights.push(`Views turun ${pct(-trendPct)}% dibanding periode sebelumnya.`);
    if (previews === 0) insights.push("Belum ada yang membuka preview produk ini pada rentang ini.");

    summaries.push({
      id: meta?.id ?? null,
      slug,
      title: meta?.title ?? slug,
      previews,
      visitors: visitors.size,
      read,
      curious,
      left,
      interestRate,
      readRate,
      bounceRate,
      medianDwellMs,
      avgScroll,
      reachedEndPct,
      sessionsWithPreview,
      sessionsWithCheckout,
      toCheckoutRate,
      purchases,
      revenue,
      cvr,
      checkoutToPurchase,
      repeatViewers,
      bestSource,
      trendPct,
      interestScore,
      intentScore,
      conversionScore,
      grade,
      stage,
      funnel,
      insights: insights.slice(0, 3),
    });
  }

  // Include products with zero events so "Ignored" shows up.
  for (const p of products) {
    if (buckets.has(p.slug)) continue;
    const pur = purchaseByProduct.get(p.id) || { count: 0, revenue: 0 };
    summaries.push(emptySummary(p, pur));
  }

  return summaries.sort((a, b) => b.previews - a.previews);
}

function emptySummary(p: ProductMeta, pur: { count: number; revenue: number }): ProductSummary {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    previews: 0,
    visitors: 0,
    read: 0,
    curious: 0,
    left: 0,
    interestRate: 0,
    readRate: 0,
    bounceRate: 0,
    medianDwellMs: 0,
    avgScroll: 0,
    reachedEndPct: 0,
    sessionsWithPreview: 0,
    sessionsWithCheckout: 0,
    toCheckoutRate: 0,
    purchases: pur.count,
    revenue: pur.revenue,
    cvr: 0,
    checkoutToPurchase: 0,
    repeatViewers: 0,
    bestSource: null,
    trendPct: 0,
    interestScore: 0,
    intentScore: 0,
    conversionScore: 0,
    grade: null,
    stage: "ignored",
    funnel: { reach: "gray", interest: "gray", intent: "gray", convert: "gray" },
    insights: ["Belum ada yang membuka preview produk ini pada rentang ini."],
  };
}

/** Shared data fetch + aggregation for a set of products (by id). */
async function buildSummaries(
  admin: ReturnType<typeof createAdminClient>,
  products: ProductMeta[],
  range: Range,
  slugFilter?: string,
): Promise<ProductSummary[]> {
  if (products.length === 0) return [];
  const nowMinus = (d: number) => sinceIso(d);
  const boundaryIso = nowMinus(range);
  const windowStartIso = nowMinus(range * 2); // include previous window for trend

  let evQuery = admin
    .from("lp_page_events")
    .select("session_id, visitor_id, product_slug, page_type, dwell_ms, scroll_depth, reached_end, engagement, created_at")
    .in("page_type", ["preview", "checkout"])
    .gte("created_at", windowStartIso)
    .order("created_at", { ascending: false })
    .limit(CAP_EVENTS);
  if (slugFilter) evQuery = evQuery.eq("product_slug", slugFilter);

  const productIds = products.map((p) => p.id);
  const [{ data: evRaw }, { data: purRaw }] = await Promise.all([
    evQuery,
    admin
      .from("lp_purchases")
      .select("landing_page_id, amount")
      .in("landing_page_id", productIds)
      .gte("purchased_at", boundaryIso),
  ]);

  const events = (evRaw ?? []) as EventRow[];

  // Source/device per session (only sessions present in the events).
  const sessionIds = [...new Set(events.map((e) => e.session_id))];
  const sourceBySession = new Map<string, SourceMeta>();
  if (sessionIds.length) {
    for (let i = 0; i < sessionIds.length; i += 1000) {
      const chunk = sessionIds.slice(i, i + 1000);
      const { data: ss } = await admin
        .from("lp_sessions")
        .select("session_id, utm_source, referrer_host, device")
        .in("session_id", chunk);
      for (const s of (ss ?? []) as { session_id: string; utm_source: string | null; referrer_host: string | null; device: string | null }[]) {
        sourceBySession.set(s.session_id, { source: s.utm_source, referrerHost: s.referrer_host, device: s.device });
      }
    }
  }

  const purchaseByProduct = new Map<string, { count: number; revenue: number }>();
  for (const p of (purRaw ?? []) as { landing_page_id: string; amount: number | null }[]) {
    const cur = purchaseByProduct.get(p.landing_page_id) ?? { count: 0, revenue: 0 };
    cur.count++;
    cur.revenue += Number(p.amount) || 0;
    purchaseByProduct.set(p.landing_page_id, cur);
  }

  return summarize(products, events, boundaryIso, sourceBySession, purchaseByProduct);
}

/** Cross-product leaderboard (admin only). */
export async function getProductSummaries(range: Range = 30): Promise<ProductSummary[]> {
  if (!(await requireAdmin())) return [];
  const admin = createAdminClient();
  const { data: prods } = await admin.from("lp_landing_pages").select("id, slug, title");
  const products = ((prods ?? []) as ProductMeta[]).filter((p) => p.slug);
  return buildSummaries(admin, products, range);
}

/** Single-product summary — admin or the product's owner. */
export async function getProductSummary(pageId: string, range: Range = 30): Promise<ProductSummary | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const isAdmin = await requireAdmin();
  const q = supabase.from("lp_landing_pages").select("id, slug, title").eq("id", pageId);
  const { data: prod } = await (isAdmin ? q : q.eq("user_id", user.id)).single();
  if (!prod) return null;

  const admin = createAdminClient();
  const list = await buildSummaries(admin, [prod as ProductMeta], range, (prod as ProductMeta).slug);
  return list[0] ?? null;
}
