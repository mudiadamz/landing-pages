/**
 * Business ledger — the money side of multi-business SaaS
 * (docs/plans/multi-business-saas.md, Fase 3).
 *
 * RECORDING ONLY. This writes double-entry bookkeeping rows when a sale settles:
 * a `sale` credit and a `commission` debit, so a business's balance = SUM(amount).
 * It moves NO money — payout execution, refunds and KYC gating are deliberately
 * separate, reviewed work. Entries land as `pending` and become `available` after
 * a hold window (refund protection), which a later phase will read.
 *
 * Every call is wrapped by the caller in try/catch: a bookkeeping failure must
 * NEVER break a purchase confirmation. Idempotency is the caller's job — record
 * only on a genuinely new sale, keyed by orderRef.
 */
import type { createAdminClient } from "@/lib/db/admin";

type Admin = ReturnType<typeof createAdminClient>;

const HOLD_DAYS = 14;

/**
 * Resolve the selling business from the product (or the storefront it sold on),
 * then write the sale + commission rows. Returns the business id it credited, or
 * null if none could be resolved (nothing recorded).
 */
export async function recordSale(
  db: Admin,
  input: { landingPageId: string; siteId: string | null; amount: number; orderRef: string },
): Promise<string | null> {
  const amount = Math.max(0, Math.round(input.amount));
  if (amount === 0) return null; // free products carry no money

  // Business owning the product; fall back to the storefront's business.
  const { data: product } = await db
    .from("lp_landing_pages")
    .select("business_id")
    .eq("id", input.landingPageId)
    .maybeSingle();
  let businessId: string | null = (product?.business_id as string | null) ?? null;
  if (!businessId && input.siteId) {
    const { data: site } = await db
      .from("lp_sites")
      .select("business_id")
      .eq("id", input.siteId)
      .maybeSingle();
    businessId = (site?.business_id as string | null) ?? null;
  }
  if (!businessId) return null;

  // Already recorded for this order? (defensive idempotency)
  const { data: seen } = await db
    .from("lp_business_ledger")
    .select("id")
    .eq("order_ref", input.orderRef)
    .eq("kind", "sale")
    .maybeSingle();
  if (seen) return businessId;

  const { data: biz } = await db
    .from("lp_businesses")
    .select("commission_pct")
    .eq("id", businessId)
    .maybeSingle();
  const pct = Number(biz?.commission_pct ?? 0);
  const commission = Math.round((amount * pct) / 100);
  const availableAt = new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db.from("lp_business_ledger").insert([
    {
      business_id: businessId,
      kind: "sale",
      amount_cents: amount,
      status: "pending",
      order_ref: input.orderRef,
      available_at: availableAt,
    },
    {
      business_id: businessId,
      kind: "commission",
      amount_cents: -commission,
      status: "pending",
      order_ref: input.orderRef,
      available_at: availableAt,
    },
  ]);
  return businessId;
}
