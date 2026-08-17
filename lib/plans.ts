/* User plans and what each one is allowed to do.
 *
 * The registry is the authority; `lp_profiles.plan` only stores the key, and an
 * unknown one reads as `free` (invariant I12). So changing what Pro includes is
 * this file plus a review — no migration, and no storefront left broken by a plan
 * that was renamed.
 *
 * Framework-free on purpose, like lib/features.ts: the chat route, the panel, a
 * client component and the pricing page all need these numbers, and anything
 * imported here would be pulled into all four.
 *
 * PRICES ARE NOT HERE. They are per-storefront and editable at /panel/plans (see
 * lp_site_settings `plan_prices`) — a limit is a product decision, a price is a
 * business one, and they change on completely different clocks. */

export const PLAN_KEYS = ["free", "pro", "business", "enterprise"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const DEFAULT_PLAN: PlanKey = "free";

/** `null` means no ceiling. Explicit, so an unlimited plan cannot read as zero. */
export type Unlimited = null;

export type PlanLimits = {
  /**
   * Chat turns in a rolling 24 hours.
   *
   * Rolling, not "resets at midnight": midnight is a timezone question this app
   * has no answer for — one deployment serves storefronts and visitors in
   * whatever zone they happen to be in, and a quota that resets at the server's
   * midnight is a quota that resets in the middle of somebody's afternoon.
   */
  chatMessagesPerDay: number | Unlimited;
  /**
   * Whether a message may trigger a web search.
   *
   * Off for Free because this is where the money actually goes: OpenRouter bills
   * a flat ~$0.007 per search regardless of results, so one searching free user
   * can cost more than a hundred chatting ones.
   */
  chatWebSearch: boolean;
  /** Attachments per message. Also capped by OPENROUTER_MAX_FILES. */
  chatMaxFiles: number;
  /** Messages resent to the model per turn — how far back the model can see. */
  chatHistory: number;
  /** Products a seller may own. Draft or published, revoked or not. */
  maxProducts: number | Unlimited;
};

export type PlanDef = {
  key: PlanKey;
  label: string;
  /** One line for the pricing page. */
  note: string;
  limits: PlanLimits;
  /**
   * Whether it can be bought from /upgrade at all. Enterprise is a conversation,
   * not a checkout — the panel can still grant it.
   */
  selfServe: boolean;
};

/**
 * The chat numbers below were agreed on 2026-08-18. The PRODUCT numbers are a
 * starting proposal from the same session and have not been through the same
 * conversation — change `maxProducts` before this matters to a real seller.
 */
export const PLANS: Record<PlanKey, PlanDef> = {
  free: {
    key: "free",
    label: "Free",
    note: "Cukup untuk mencoba: 20 pesan sehari, tanpa pencarian web.",
    limits: {
      chatMessagesPerDay: 20,
      chatWebSearch: false,
      chatMaxFiles: 1,
      chatHistory: 20,
      maxProducts: 1,
    },
    selfServe: false,
  },
  pro: {
    key: "pro",
    label: "Pro",
    note: "Untuk pemakaian harian: pencarian web, lampiran, riwayat lebih panjang.",
    limits: {
      chatMessagesPerDay: 300,
      chatWebSearch: true,
      chatMaxFiles: 6,
      chatHistory: 40,
      maxProducts: 20,
    },
    selfServe: true,
  },
  business: {
    key: "business",
    label: "Business",
    note: "Untuk tim kecil: kuota besar dan katalog produk yang lebih luas.",
    limits: {
      chatMessagesPerDay: 2000,
      chatWebSearch: true,
      chatMaxFiles: 6,
      chatHistory: 80,
      maxProducts: 100,
    },
    selfServe: true,
  },
  enterprise: {
    key: "enterprise",
    label: "Enterprise",
    note: "Tanpa batas pesan dan produk. Hubungi kami untuk penyesuaian.",
    limits: {
      chatMessagesPerDay: null,
      chatWebSearch: true,
      chatMaxFiles: 12,
      chatHistory: 160,
      maxProducts: null,
    },
    selfServe: false,
  },
};

export const PLAN_LIST: PlanDef[] = PLAN_KEYS.map((key) => PLANS[key]);

/** Coerce whatever the column holds into a plan we ship. */
export function normalizePlan(raw: unknown): PlanKey {
  return typeof raw === "string" && (PLAN_KEYS as readonly string[]).includes(raw)
    ? (raw as PlanKey)
    : DEFAULT_PLAN;
}

/**
 * The plan actually in force, expiry included.
 *
 * Every reader goes through this rather than reading the column: a lapsed Pro row
 * still says "pro", and a caller that trusted the column would keep handing out
 * searches for free. `null` expiry means it does not lapse (admin-granted, or
 * free).
 */
export function effectivePlan(raw: unknown, expiresAt: string | null | undefined, now = Date.now()): PlanKey {
  const plan = normalizePlan(raw);
  if (plan === DEFAULT_PLAN || !expiresAt) return plan;
  const ends = new Date(expiresAt).getTime();
  if (Number.isNaN(ends)) return plan; // an unparseable date must not silently downgrade
  return ends > now ? plan : DEFAULT_PLAN;
}

export function planLimits(plan: PlanKey): PlanLimits {
  return PLANS[plan].limits;
}

/** True when `value` is within a limit. `null` means there is no limit. */
export function withinLimit(used: number, limit: number | Unlimited): boolean {
  return limit === null || used < limit;
}

/** The next plan up, for an "upgrade to…" prompt. Enterprise is the ceiling. */
export function nextPlanUp(plan: PlanKey): PlanKey | null {
  const i = PLAN_KEYS.indexOf(plan);
  return i >= 0 && i < PLAN_KEYS.length - 1 ? PLAN_KEYS[i + 1] : null;
}

/* -------------------------------------------------------------------------- */
/*  Prices                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What each paid plan costs PER MONTH, in rupiah, on one storefront.
 *
 * Per storefront and not in this file, because a price is a business decision on
 * a different clock from a limit: lp_site_settings key `plan_prices`, edited at
 * /panel/plans. Free is absent — it has no price by definition.
 *
 * ZERO MEANS NOT FOR SALE, not "free of charge": nothing is purchasable until an
 * admin has typed a number, so a fresh deployment cannot accidentally sell Pro
 * for nothing. The upgrade page renders those plans as "hubungi kami" instead of
 * a buy button.
 */
export type PaidPlanKey = Exclude<PlanKey, "free">;

export type PlanPrices = Record<PaidPlanKey, number>;

export const PAID_PLAN_KEYS: PaidPlanKey[] = ["pro", "business", "enterprise"];

export const DEFAULT_PLAN_PRICES: PlanPrices = { pro: 0, business: 0, enterprise: 0 };

/** A price nobody typed by accident: ~100 juta is far past any plausible plan. */
const MAX_PLAN_PRICE = 100_000_000;

export function normalizePlanPrices(raw: unknown): PlanPrices {
  const v = (raw ?? {}) as Record<string, unknown>;
  const one = (value: unknown): number => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, MAX_PLAN_PRICE);
  };
  return { pro: one(v.pro), business: one(v.business), enterprise: one(v.enterprise) };
}

/** Whether this plan can actually be bought right now on this storefront. */
export function isPurchasable(plan: PlanKey, prices: PlanPrices): boolean {
  if (plan === "free") return false;
  return PLANS[plan].selfServe && prices[plan as PaidPlanKey] > 0;
}

/** Rupiah, the way the rest of the site writes it. */
export function formatRupiah(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}
