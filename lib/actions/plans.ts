"use server";

/**
 * Reading and granting plans.
 *
 * The plan lives on the PROFILE, not on the site: one account, one plan, and it
 * follows the visitor to whichever storefront they open. What is per-site is the
 * PRICE (lp_site_settings `plan_prices`, edited at /panel/plans) — the same Pro
 * can be sold for different money on two storefronts, and usually is.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/actions/profiles";
import { chatMessagesUsed } from "@/lib/mbahgpt/quota";
import { effectivePlan, normalizePlan, planLimits, type PlanKey, type PlanLimits } from "@/lib/plans";

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

  const { data } = await supabase
    .from("lp_profiles")
    .select("plan, plan_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  const stored = normalizePlan(data?.plan);
  const plan = effectivePlan(data?.plan, data?.plan_expires_at ?? null);
  return {
    plan,
    stored,
    expiresAt: data?.plan_expires_at ?? null,
    limits: planLimits(plan),
    used: await chatMessagesUsed(supabase, user.id),
  };
}

/**
 * Put a user on a plan, by hand.
 *
 * Admin-only, and it stays even after the paid upgrade flow exists: a refund, a
 * comped account and a support fix all need a way in that does not involve
 * charging somebody. `expiresAt = null` means it does not lapse.
 *
 * Service-role, because a profile row is not writable by another user under RLS —
 * so `requireAdmin()` above is the whole gate (invariant I6).
 */
export async function setUserPlan(
  userId: string,
  plan: string,
  expiresAt: string | null = null,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: "Akses ditolak." };

  const key = normalizePlan(plan);
  // An unknown key would silently land everyone on free; say so instead.
  if (key !== plan) return { ok: false, error: `Paket "${plan}" tidak dikenal.` };

  const admin = createAdminClient();
  const { error } = await admin
    .from("lp_profiles")
    .update({ plan: key, plan_expires_at: key === "free" ? null : expiresAt })
    .eq("id", userId);

  if (error) {
    console.error("setUserPlan error:", error);
    return { ok: false, error: "Gagal menyimpan paket." };
  }
  revalidatePath("/panel/users");
  return { ok: true };
}
