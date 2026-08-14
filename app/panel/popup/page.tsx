import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { getPopupBanner } from "@/lib/actions/site-settings";
import { editingSite, listSites } from "@/lib/site-resolve";
import { SiteScopeNotice } from "@/components/site-scope-notice";
import { PopupForm } from "./popup-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export const metadata = { title: "Popup banner" };

export default async function PopupPage() {
  const t = translator(await requestLocale());
  if (!(await requireAdmin())) redirect("/panel");

  const [site, sites] = await Promise.all([editingSite(), listSites()]);
  const popup = await getPopupBanner(site.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.navPopup")} />

      <SiteScopeNotice host={site.host} name={site.name} siteCount={sites.length} />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        <PopupForm key={site.id} initial={popup} siteId={site.id} />
      </div>
    </div>
  );
}
