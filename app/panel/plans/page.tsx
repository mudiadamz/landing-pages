import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/actions/profiles";
import { editingSite } from "@/lib/site-resolve";
import { PanelSiteFilter } from "@/components/panel-site-filter";
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

  // Situs yang sedang difilter, bukan host request. Tanpa ini layar ini membaca
  // dan menulis setelan situs KANONIK apa pun pilihan filternya — filter yang
  // tidak memfilter apa-apa lebih buruk daripada tidak ada filter.
  const site = await editingSite();
  const [prices, overrides, meta] = await Promise.all([
    getPlanPrices(site.id),
    getPlanLimits(site.id),
    getPlanMeta(site.id),
  ]);

  return (
    <div className="space-y-6">
      <PanelSiteFilter />
      <PanelPageHeader backHref="/panel" title={t("panel.navPlans")} />
      <PlansForm siteId={site.id}
        initialPrices={prices}
        initialLimits={resolveAllPlanLimits(overrides)}
        initialMeta={{ enabled: meta.enabled, plans: resolveAllPlanMeta(meta) }}
      />
    </div>
  );
}
