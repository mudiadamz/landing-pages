import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/actions/profiles";
import { getPopupBanner } from "@/lib/actions/site-settings";
import { editingSite } from "@/lib/site-resolve";
import { PanelSiteFilter } from "@/components/panel-site-filter";
import { PopupForm } from "./popup-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export async function generateMetadata() {
  return { title: translator(await requestLocale())("panel.navPopup") };
}

export default async function PopupPage() {
  const t = translator(await requestLocale());
  if (!(await requireSiteAdmin())) redirect("/panel");

  const site = await editingSite();
  const popup = await getPopupBanner(site.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.navPopup")} />

      <PanelSiteFilter />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        <PopupForm key={site.id} initial={popup} siteId={site.id} />
      </div>
    </div>
  );
}
