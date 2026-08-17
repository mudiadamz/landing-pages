import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { getPlanPrices } from "@/lib/actions/site-settings";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { PlanPricesForm } from "./prices-form";

/**
 * What each plan costs on this storefront.
 *
 * Only the PRICE is editable here. The limits beside it are read-only, rendered
 * straight from lib/plans.ts, because they are code: an admin who could raise
 * Free's message quota from a form would be changing what the deployment spends
 * on OpenRouter without a review. Showing them anyway is the point of the screen —
 * a price with no idea what it buys is not a decision anyone can make.
 */
export default async function PlansPage() {
  const t = translator(await requestLocale());
  if (!(await requireAdmin())) redirect("/panel");

  const prices = await getPlanPrices();

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.navPlans")} />
      <PlanPricesForm initial={prices} />
    </div>
  );
}
