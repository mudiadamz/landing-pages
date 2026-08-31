import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/actions/profiles";
import { getHiringContent } from "@/lib/actions/site-settings";
import { editingSite } from "@/lib/site-resolve";
import { PanelSiteFilter } from "@/components/panel-site-filter";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { HiringForm } from "./hiring-form";

export async function generateMetadata() {
  return { title: translator(await requestLocale())("panel.navHiring") };
}

export default async function HiringSettingsPage() {
  const t = translator(await requestLocale());
  const ok = await requireFeature("hiring");
  if (!ok) redirect("/panel");

  const site = await editingSite();
  const hiring = await getHiringContent(site.id);

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.navHiring")} />

      <p className="text-sm text-[var(--muted)]">{t("hiring.panelIntro")}</p>

      <PanelSiteFilter />

      <HiringForm key={site.id} initial={hiring} siteId={site.id} />
    </div>
  );
}
