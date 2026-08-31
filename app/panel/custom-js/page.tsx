import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/actions/profiles";
import { getCustomJs } from "@/lib/actions/site-settings";
import { editingSite } from "@/lib/site-resolve";
import { PanelSiteFilter } from "@/components/panel-site-filter";
import { CustomJsForm } from "./custom-js-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export default async function CustomJsPage() {
  const t = translator(await requestLocale());
  const ok = await requireFeature("custom-js");
  if (!ok) redirect("/panel");

  const site = await editingSite();
  const initialScript = await getCustomJs(site.id);

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.titleCustomJs")} />

      <PanelSiteFilter />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <p className="text-sm text-[var(--muted)] mb-4">
          {t("panel.customJsIntro")}
        </p>
        <CustomJsForm key={site.id} initialScript={initialScript} siteId={site.id} />
      </div>
    </div>
  );
}
