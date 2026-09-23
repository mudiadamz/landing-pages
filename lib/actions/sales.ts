"use server";

import { createAdminClient } from "@/lib/db/admin";
import { getProfile, requireFeature, currentSiteStanding } from "./profiles";
import { fetchAllRows } from "@/lib/paginate";
import { panelScope } from "@/lib/site-scope";

/**
 * Everything /panel/sales needs, in one role-scoped read.
 *
 * Two audiences, one shape. An admin sees the whole shop; a publisher sees only
 * rows belonging to products they own. Scoping happens here rather than in the
 * page so a publisher can't reach the global figures by rendering a different
 * component — the same split /panel/stats enforced before, kept deliberately.
 *
 * Reads with the service role because a seller is not the buyer on lp_purchases,
 * so RLS would hide their own sales from them.
 *
 * On revoked rows: they still count as sales and as revenue. Revoking is an
 * access decision, not a refund — the money was taken either way — but the
 * revoked share is reported alongside every count so a catalog that looks
 * healthy can't hide that most of it has been withdrawn.
 */

export type SalesProductRow = {
  id: string;
  title: string;
  sold: number;
  revoked: number;
  revenue: number;
};

export type RecentSale = {
  id: string;
  at: string;
  amount: number;
  method: string | null;
  revoked: boolean;
  productTitle: string;
  buyerName: string | null;
  buyerEmail: string | null;
};

export type SalesOverview = {
  scope: "global" | "own";
  revenueTotal: number;
  revenue30: number;
  salesTotal: number;
  salesRevoked: number;
  sales30: number;
  productCount: number;
  /** Distinct buyers. Global scope only — 0 for a publisher's own view. */
  buyerCount: number;
  products: SalesProductRow[];
  recent: RecentSale[];
};

const RECENT_LIMIT = 25;
const CAP_PURCHASES = 100_000;

export async function getSalesOverview(): Promise<SalesOverview | null> {
  const profile = await getProfile();
  if (!profile) return null;

  // "Hanya produk saya" berlaku untuk publisher DI SITUS yang sedang dilihat —
  // izin jualnya per situs sekarang, jadi cakupan angkanya ikut.
  const standing = await currentSiteStanding();
  // A publisher who is nobody else here sees only their own numbers. Since Fase 5
  // the "nobody else" half is asked of this site: Platform, and anyone who runs
  // the business that owns it, get the global figures.
  const sellerOnly =
    !!standing?.isPublisher && !standing.isAgent && !standing.businessRole && !profile.is_platform;
  const global = !sellerOnly && (await requireFeature("stats"));
  if (!global && !sellerOnly) return null;

  const db = createAdminClient();
  // Storefront scope, from the sidebar switcher. Unattributed purchases (before the
  // site_id column existed) count with the canonical site.
  const { filter: scope } = await panelScope();

  // Products in scope.
  let pageQuery = db.from("lp_landing_pages").select("id, title");
  if (!global) pageQuery = pageQuery.eq("user_id", profile.id);
  const { data: pages } = await pageQuery;
  const products = pages ?? [];
  const titleById = new Map(products.map((p) => [p.id, p.title as string]));
  const ids = products.map((p) => p.id);

  if (!global && ids.length === 0) {
    return {
      scope: "own",
      revenueTotal: 0, revenue30: 0,
      salesTotal: 0, salesRevoked: 0, sales30: 0,
      productCount: 0, buyerCount: 0,
      products: [], recent: [],
    };
  }

  // Paged rather than limited: PostgREST caps a bare .limit() at max_rows and
  // says nothing about it, which is how the analytics page once sat at exactly
  // 1000 sessions forever (see lib/paginate.ts).
  const { rows: purchases } = await fetchAllRows<{
    id: string;
    // NULL once the buyer's account is deleted — the sale stays on the books
    // without them (migration 20260829000000). Every read below has to survive
    // that, or one deleted account takes a revenue figure down with it.
    user_id: string | null;
    landing_page_id: string;
    purchased_at: string;
    amount: number | null;
    payment_method: string | null;
    revoked_at: string | null;
  }>(
    (from, to) => {
      let q = db
        .from("lp_purchases")
        .select("id, user_id, landing_page_id, purchased_at, amount, payment_method, revoked_at")
        .order("purchased_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
      if (!global) q = q.in("landing_page_id", ids);
      if (scope) q = q.or(scope.or);
      return q;
    },
    CAP_PURCHASES,
  );

  const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let revenueTotal = 0, revenue30 = 0, salesRevoked = 0, sales30 = 0;
  const byProduct = new Map<string, SalesProductRow>();
  const buyers = new Set<string>();

  for (const p of purchases) {
    const amount = Number(p.amount ?? 0);
    const recent = new Date(p.purchased_at).getTime() >= cutoff30;

    revenueTotal += amount;
    if (recent) { revenue30 += amount; sales30 += 1; }
    if (p.revoked_at) salesRevoked += 1;
    if (p.user_id) buyers.add(p.user_id);

    const row = byProduct.get(p.landing_page_id) ?? {
      id: p.landing_page_id,
      title: titleById.get(p.landing_page_id) ?? "(produk dihapus)",
      sold: 0, revoked: 0, revenue: 0,
    };
    row.sold += 1;
    row.revenue += amount;
    if (p.revoked_at) row.revoked += 1;
    byProduct.set(p.landing_page_id, row);
  }

  // Products with no sales still belong in the table — a zero is information.
  for (const p of products) {
    if (!byProduct.has(p.id)) {
      byProduct.set(p.id, { id: p.id, title: p.title as string, sold: 0, revoked: 0, revenue: 0 });
    }
  }

  // Buyer identities, for the recent list only.
  const head = purchases.slice(0, RECENT_LIMIT);
  const buyerIds = [...new Set(head.map((p) => p.user_id).filter((id): id is string => !!id))];
  const profileById = new Map<string, { full_name: string | null; email: string | null }>();
  if (buyerIds.length) {
    const { data: profs } = await db
      .from("lp_profiles")
      .select("id, full_name, email")
      .in("id", buyerIds);
    for (const p of profs ?? []) profileById.set(p.id, { full_name: p.full_name, email: p.email });
  }

  return {
    scope: global ? "global" : "own",
    revenueTotal,
    revenue30,
    salesTotal: purchases.length,
    salesRevoked,
    sales30,
    productCount: products.length,
    buyerCount: global ? buyers.size : 0,
    products: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue || b.sold - a.sold),
    recent: head.map((p) => ({
      id: p.id,
      at: p.purchased_at,
      amount: Number(p.amount ?? 0),
      method: p.payment_method,
      revoked: !!p.revoked_at,
      productTitle: titleById.get(p.landing_page_id) ?? "(produk dihapus)",
      buyerName: p.user_id ? (profileById.get(p.user_id)?.full_name ?? null) : null,
      buyerEmail: p.user_id ? (profileById.get(p.user_id)?.email ?? null) : null,
    })),
  };
}
