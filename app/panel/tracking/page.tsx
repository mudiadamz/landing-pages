import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { getTracking } from "@/lib/actions/site-settings";
import { editingSite, listSites } from "@/lib/site-resolve";
import { SiteScopeNotice } from "@/components/site-scope-notice";
import { TrackingForm } from "./tracking-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export const metadata = { title: "Tracking" };

export default async function TrackingPage() {
  const t = translator(await requestLocale());
  if (!(await requireAdmin())) redirect("/panel");

  const [site, sites] = await Promise.all([editingSite(), listSites()]);
  const tracking = await getTracking(site.id);
  const fromEnv = !!process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.navTracking")} />

      <SiteScopeNotice host={site.host} name={site.name} siteCount={sites.length} />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">{t("panel.gtmHeading")}</h2>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          {t("panel.gtmIntroBefore")}{" "}
          <code className="rounded bg-[var(--background)] px-1">GTM-XXXXXXX</code>
          {t("panel.gtmIntroAfter")}
        </p>
        <TrackingForm
          key={site.id}
          initialGtmId={tracking.gtmId}
          initialTawkPropertyId={tracking.tawkPropertyId}
          initialTawkWidgetId={tracking.tawkWidgetId}
          siteId={site.id}
        />
        {fromEnv && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            {t("panel.gtmEnvBefore")}{" "}
            <code className="rounded bg-[var(--background)] px-1">NEXT_PUBLIC_GTM_ID</code>{" "}
            {t("panel.gtmEnvAfter")}
          </p>
        )}
      </div>
    </div>
  );
}
