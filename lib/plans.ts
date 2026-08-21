/* User plans: the keys, the DEFAULTS, and how a storefront overrides them.
 *
 * `lp_profiles.plan` stores only the key, and an unknown one reads as `free`
 * (invariant I12) — that part has not changed and should not.
 *
 * What the numbers below are is DEFAULTS, not the law. Both the price and the
 * limits are editable per storefront at /panel/plans (lp_site_settings
 * `plan_prices` and `plan_limits`), because the person paying the OpenRouter bill
 * is the person who should be able to decide what Free costs them — without a
 * deploy, and without asking whoever holds the repository.
 *
 * They stay here as the fallback, and that is load-bearing: an absent setting, a
 * malformed one, and a storefront that has never opened the screen all resolve to
 * these, so the app is never left without an answer to "how many messages may
 * this person send".
 *
 * The deployment's own ceilings (OPENROUTER_MAX_FILES, OPENROUTER_MAX_HISTORY)
 * still win over anything typed into the panel: a plan may narrow what the server
 * is willing to spend, never widen it. That comparison lives in the chat route.
 *
 * Framework-free on purpose, like lib/features.ts: the chat route, the panel, a
 * client component and the pricing page all need these numbers, and anything
 * imported here would be pulled into all four. */

/**
 * The tier SLOTS this deployment ships. Six, not four.
 *
 * `tier5`/`tier6` are spare capacity: shipped hidden and unnamed, so a storefront
 * that wants a fifth tier turns one on and names it at /panel/plans instead of
 * waiting for a deploy. They are slots and not free-form rows on purpose —
 * `lp_profiles.plan` stores a key, an unknown key reads as `free` (invariant
 * I12), and a key an admin could invent is a key that can stop existing while
 * somebody is still on it. A slot cannot.
 *
 * ORDER IS MEANINGFUL: "upgrade" means "further down this list", so a new slot
 * belongs at the END even when its price sits between two existing ones.
 */
export const PLAN_KEYS = ["free", "pro", "business", "enterprise", "tier5", "tier6"] as const;
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
  /**
   * Whether a visitor is shown this tier by default. The spare slots ship false:
   * an unnamed "Tier 5" column on a pricing table is worse than four columns.
   * A storefront overrides this per tier at /panel/plans.
   */
  visible: boolean;
};

/**
 * The shipped defaults. A storefront that has never opened /panel/plans runs on
 * exactly these.
 *
 * The chat numbers were agreed on 2026-08-18; the product numbers are a proposal
 * from the same session that has not been through the same conversation.
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
    visible: true,
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
    visible: true,
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
    visible: true,
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
    visible: true,
  },
  // The spare slots. Their numbers are a copy of Business rather than something
  // invented: a slot nobody has configured should behave like a plan that exists,
  // not like one with a quota of zero, in case it is switched on before it is
  // filled in.
  tier5: {
    key: "tier5",
    label: "Tier 5",
    note: "",
    limits: {
      chatMessagesPerDay: 2000,
      chatWebSearch: true,
      chatMaxFiles: 6,
      chatHistory: 80,
      maxProducts: 100,
    },
    selfServe: true,
    visible: false,
  },
  tier6: {
    key: "tier6",
    label: "Tier 6",
    note: "",
    limits: {
      chatMessagesPerDay: 2000,
      chatWebSearch: true,
      chatMaxFiles: 6,
      chatHistory: 80,
      maxProducts: 100,
    },
    selfServe: true,
    visible: false,
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

/** The shipped default for a plan, before any storefront override. */
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

export const PAID_PLAN_KEYS: PaidPlanKey[] = ["pro", "business", "enterprise", "tier5", "tier6"];

export const DEFAULT_PLAN_PRICES: PlanPrices = { pro: 0, business: 0, enterprise: 0, tier5: 0, tier6: 0 };

/** A price nobody typed by accident: ~100 juta is far past any plausible plan. */
const MAX_PLAN_PRICE = 100_000_000;

export function normalizePlanPrices(raw: unknown): PlanPrices {
  const v = (raw ?? {}) as Record<string, unknown>;
  const one = (value: unknown): number => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, MAX_PLAN_PRICE);
  };
  return {
    pro: one(v.pro),
    business: one(v.business),
    enterprise: one(v.enterprise),
    tier5: one(v.tier5),
    tier6: one(v.tier6),
  };
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

/* -------------------------------------------------------------------------- */
/*  Per-storefront limits                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What a storefront has changed about its plans, as stored in lp_site_settings
 * `plan_limits`.
 *
 * A partial map on purpose: only what was actually edited is written, so a plan
 * the owner never touched keeps following the shipped default even when that
 * default later changes. Storing a full copy would freeze today's numbers into
 * every site the first time somebody opened the screen.
 */
export type PlanLimitsOverrides = Partial<Record<PlanKey, Partial<PlanLimits>>>;

/** Whole numbers only, and never negative. `null` is a deliberate "no ceiling". */
function limitNumber(value: unknown, fallback: number | Unlimited): number | Unlimited {
  if (value === null) return null;
  if (value === undefined || value === "") return fallback;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/** A fixed number: used where "unlimited" makes no sense (files, history depth). */
function limitFixed(value: unknown, fallback: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

/** Sanity ceilings on what the panel may store — not the deployment's own caps. */
const MAX_FILES_SETTING = 20;
const MAX_HISTORY_SETTING = 400;

export function normalizePlanLimitsOverrides(raw: unknown): PlanLimitsOverrides {
  const v = (raw ?? {}) as Record<string, unknown>;
  const out: PlanLimitsOverrides = {};

  for (const key of PLAN_KEYS) {
    const entry = v[key];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const base = PLANS[key].limits;
    out[key] = {
      chatMessagesPerDay: limitNumber(e.chatMessagesPerDay, base.chatMessagesPerDay),
      chatWebSearch:
        typeof e.chatWebSearch === "boolean" ? e.chatWebSearch : base.chatWebSearch,
      chatMaxFiles: limitFixed(e.chatMaxFiles, base.chatMaxFiles, MAX_FILES_SETTING),
      chatHistory: limitFixed(e.chatHistory, base.chatHistory, MAX_HISTORY_SETTING),
      maxProducts: limitNumber(e.maxProducts, base.maxProducts),
    };
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Per-storefront tier metadata (name, note, visibility)                      */
/* -------------------------------------------------------------------------- */

/** What a storefront may rewrite about ONE tier. */
export type PlanMetaOverride = { label: string; note: string; visible: boolean };

/**
 * Everything a storefront decides about its tiers other than the numbers.
 *
 * `enabled` is the master switch and lives here rather than in its own settings
 * key so the pricing page answers "do we sell tiers at all" and "which ones" in
 * a single read. Off means /upgrade does not exist on this domain and no button
 * anywhere offers it — not merely that the table renders empty.
 */
export type PlanMeta = {
  enabled: boolean;
  plans: Partial<Record<PlanKey, PlanMetaOverride>>;
};

export const DEFAULT_PLAN_META: PlanMeta = { enabled: true, plans: {} };

/** A label an admin typed. Trimmed, length-capped, and never allowed to be blank —
 *  an empty name would render a column with no heading. */
function planText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, max);
  return trimmed || fallback;
}

const MAX_PLAN_LABEL = 40;
const MAX_PLAN_NOTE = 160;

export function normalizePlanMeta(raw: unknown): PlanMeta {
  const v = (raw ?? {}) as Record<string, unknown>;
  const plans = (v.plans ?? {}) as Record<string, unknown>;
  const out: PlanMeta["plans"] = {};

  for (const key of PLAN_KEYS) {
    const entry = plans[key];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const base = PLANS[key];
    out[key] = {
      label: planText(e.label, base.label, MAX_PLAN_LABEL),
      // A note MAY be blank — the spare slots ship with none, and forcing the
      // shipped fallback back in would make an emptied field un-emptiable.
      note: typeof e.note === "string" ? e.note.trim().slice(0, MAX_PLAN_NOTE) : base.note,
      visible: typeof e.visible === "boolean" ? e.visible : base.visible,
    };
  }
  // Absent reads as ON: a storefront that has never opened the screen still
  // sells, which is what it did before this setting existed.
  return { enabled: v.enabled !== false, plans: out };
}

/** Name, note and visibility in force for one tier on one storefront. */
export function resolvePlanMeta(plan: PlanKey, meta: PlanMeta): PlanMetaOverride {
  const base = PLANS[plan];
  return { label: base.label, note: base.note, visible: base.visible, ...(meta.plans[plan] ?? {}) };
}

/** Every tier's name/note/visibility resolved at once, for the panel form. */
export function resolveAllPlanMeta(meta: PlanMeta): Record<PlanKey, PlanMetaOverride> {
  return Object.fromEntries(
    PLAN_KEYS.map((key) => [key, resolvePlanMeta(key, meta)]),
  ) as Record<PlanKey, PlanMetaOverride>;
}

/**
 * The tiers this storefront actually shows, in upgrade order.
 *
 * Empty when the master switch is off — every caller that lists tiers goes
 * through here, so one `enabled: false` closes the pricing page, the upgrade
 * buttons and the invoice route together rather than one at a time.
 */
export function visiblePlanKeys(meta: PlanMeta): PlanKey[] {
  if (!meta.enabled) return [];
  return PLAN_KEYS.filter((key) => resolvePlanMeta(key, meta).visible);
}

/**
 * The limits actually in force for a plan on one storefront.
 *
 * Every enforcement point calls THIS, never `PLANS[x].limits` directly — the
 * registry is the fallback, not the answer, and a caller that reads it straight
 * would quietly ignore what the owner typed into the panel.
 */
export function resolvePlanLimits(plan: PlanKey, overrides: PlanLimitsOverrides): PlanLimits {
  return { ...PLANS[plan].limits, ...(overrides[plan] ?? {}) };
}

/** All four plans resolved at once, for the pricing table and the panel form. */
export function resolveAllPlanLimits(overrides: PlanLimitsOverrides): Record<PlanKey, PlanLimits> {
  return Object.fromEntries(
    PLAN_KEYS.map((key) => [key, resolvePlanLimits(key, overrides)]),
  ) as Record<PlanKey, PlanLimits>;
}
