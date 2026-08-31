import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/actions/profiles";
import { getPlanLimits, getPlanMeta, getPlanPrices } from "@/lib/actions/site-settings";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { resolveAllPlanLimits, resolveAllPlanMeta } from "@/lib/plans";
import { PlansForm } from "./plans-form";

/**
 * What each plan costs on this storefront, and what it actually allows.
 *
 * Both halves are editable, and deliberately on ONE screen: a price without the
 * limits beside it is a number nobody can judge, and a limit without the price is
 * a cost nobody can weigh. The owner pays the model bill for their own domain, so
 * the owner sets both — no deploy, no repository access.
 *
 * The one thing this screen cannot do is exceed the deployment's own ceilings
 * (OPENROUTER_MAX_FILES, OPENROUTER_MAX_HISTORY). Those are the server's limits on
 * itself, and the chat route keeps the tighter of the two.
 */
export default async function PlansPage() {
  const t = translator(await requestLocale());
  if (!(await requireSiteAdmin())) redirect("/panel");

  const [prices, overrides, meta] = await Promise.all([
    getPlanPrices(),
    getPlanLimits(),
    getPlanMeta(),
  ]);

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.navPlans")} />
      <PlansForm
        initialPrices={prices}
        initialLimits={resolveAllPlanLimits(overrides)}
        initialMeta={{ enabled: meta.enabled, plans: resolveAllPlanMeta(meta) }}
      />
    </div>
  );
}
