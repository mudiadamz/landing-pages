"use server";

/**
 * Reading and granting plans.
 *
 * The plan lives on the PROFILE, not on the site: one account, one plan, and it
 * follows the visitor to whichever storefront they open. What is per-site is the
 * PRICE (lp_site_settings `plan_prices`, edited at /panel/plans) — the same Pro
 * can be sold for different money on two storefronts, and usually is.
 */

import { createClient } from "@/lib/supabase/server";
import { chatMessagesUsed } from "@/lib/mbahgpt/quota";
import { effectivePlan, normalizePlan, planLimits, resolvePlanLimits, type PlanKey, type PlanLimits } from "@/lib/plans";
import { getPlanLimits } from "@/lib/actions/site-settings";

export type MyPlan = {
  plan: PlanKey;
  /** What the column says, before expiry is applied — the panel shows both. */
  stored: PlanKey;
  expiresAt: string | null;
  limits: PlanLimits;
  /** Chat turns spent in the rolling window. */
  used: number;
};

/** The caller's plan, or the free plan for a visitor who is not signed in. */
export async function getMyPlan(): Promise<MyPlan> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const free: MyPlan = {
    plan: "free",
    stored: "free",
    expiresAt: null,
    limits: planLimits("free"),
    used: 0,
  };
  if (!user) return free;

  const [{ data }, overrides] = await Promise.all([
    supabase.from("lp_profiles").select("plan, plan_expires_at").eq("id", user.id).maybeSingle(),
    getPlanLimits(),
  ]);

  const stored = normalizePlan(data?.plan);
  const plan = effectivePlan(data?.plan, data?.plan_expires_at ?? null);
  return {
    plan,
    stored,
    expiresAt: data?.plan_expires_at ?? null,
    limits: resolvePlanLimits(plan, overrides),
    used: await chatMessagesUsed(supabase, user.id),
  };
}
