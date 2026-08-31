import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/actions/profiles";
import { getLegalContent } from "@/lib/actions/site-settings";
import { editingSite } from "@/lib/site-resolve";
import { PanelSiteFilter } from "@/components/panel-site-filter";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { LegalForm } from "./legal-form";

export async function generateMetadata() {
  return { title: translator(await requestLocale())("panel.navLegal") };
}

export default async function LegalSettingsPage() {
  const t = translator(await requestLocale());
  const ok = await requireFeature("legal");
  if (!ok) redirect("/panel");

  const site = await editingSite();
  const legal = await getLegalContent(site.id);

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.navLegal")} />

      <p className="text-sm text-[var(--muted)]">{t("legal.intro")}</p>

      <PanelSiteFilter />

      {/* key={site.id}: switching the panel scope must reload the editors with
          the other domain's text, and RichEditor only reads its initial HTML on
          mount. */}
      <LegalForm key={site.id} initial={legal} siteId={site.id} />
    </div>
  );
}
