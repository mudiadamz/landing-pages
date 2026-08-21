import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlanLimits, getPlanMeta, getPlanPrices } from "@/lib/actions/site-settings";
import { TemplateHeader, TemplateFooter } from "@/lib/templates/chrome";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { effectivePlan, resolveAllPlanLimits, resolvePlanMeta, visiblePlanKeys } from "@/lib/plans";
import { UpgradeView } from "./upgrade-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await requestLocale());
  // Not indexed: the prices here are per-storefront, and a search result pointing
  // at one domain's pricing from another domain's listing is worse than none.
  return { title: t("plan.chooseTitle"), robots: { index: false, follow: true } };
}

/**
 * Pick a plan, pay for a year.
 *
 * A public page rather than a panel screen: the people who need it are the ones
 * who just hit a quota wall in the chat, and sending them through /panel to fix
 * that is three clicks and a context switch away from the thing they were doing.
 *
 * Chrome comes from the template dispatcher, so the page looks like whichever
 * storefront the visitor is on.
 */
export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const [supabase, locale, prices, overrides, meta, params] = await Promise.all([
    createClient(),
    requestLocale(),
    getPlanPrices(),
    // The limits this storefront actually enforces, not the shipped defaults —
    // a pricing page that advertises numbers the chat route does not honour is
    // worse than no pricing page.
    getPlanLimits(),
    getPlanMeta(),
    searchParams,
  ]);

  // The master switch, enforced as a MISSING PAGE rather than an empty one. A
  // storefront that does not sell tiers should not have a pricing URL that
  // renders a heading and nothing under it — and /upgrade is linked from the
  // chat, so "no tiers here" has to be the route's answer, not the table's.
  const shown = visiblePlanKeys(meta);
  if (!shown.length) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan = effectivePlan("free", null);
  let expiresAt: string | null = null;
  let pending = false;

  if (user) {
    const [{ data: profile }, { data: order }] = await Promise.all([
      supabase.from("lp_profiles").select("plan, plan_expires_at").eq("id", user.id).maybeSingle(),
      // Only the order they just came back from, and only while it is unsettled.
      // The callback is server-to-server and may still be in flight when the
      // browser lands here — the same race /checkout/[slug]/done handles.
      params.order
        ? supabase
            .from("lp_plan_orders")
            .select("status")
            .eq("id", params.order)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    plan = effectivePlan(profile?.plan, profile?.plan_expires_at ?? null);
    expiresAt = profile?.plan_expires_at ?? null;
    pending = (order as { status?: string } | null)?.status === "pending";
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TemplateHeader user={user} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <UpgradeView
          plan={plan}
          expiresAt={expiresAt}
          prices={prices}
          // Resolved here, in the order they are sold: the client component
          // renders what it is handed rather than filtering a global list, so a
          // hidden tier cannot reach the browser at all.
          tiers={shown.map((key) => ({ key, ...resolvePlanMeta(key, meta) }))}
          limits={resolveAllPlanLimits(overrides)}
          signedIn={!!user}
          pending={pending}
          locale={locale}
        />
      </main>
      <TemplateFooter />
    </div>
  );
}
