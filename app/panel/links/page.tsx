import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/actions/profiles";
import { editingSite } from "@/lib/site-resolve";
import { PanelSiteFilter } from "@/components/panel-site-filter";
import { getOtherLinks, getSocialUrls } from "@/lib/actions/site-settings";
import { PanelPageHeader } from "@/components/panel-page-header";
import { LinksTabs } from "./tabs";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

/**
 * The owner's other places on the internet, shown behind the link icon on the
 * homepage.
 *
 * Separate from /panel/sites, which manages STOREFRONTS this deployment serves.
 * These are somewhere else entirely — another shop, a portfolio, a newsletter —
 * and the visitor is being sent away rather than moved around.
 */
export default async function LinksPage() {
  const t = translator(await requestLocale());
  if (!(await requireSiteAdmin())) redirect("/panel");

  // Cakupan panel, bukan host request — sama seperti /panel/plans.
  const site = await editingSite();
  const [links, socialUrls] = await Promise.all([getOtherLinks(site.id), getSocialUrls(site.id)]);

  return (
    <div className="space-y-6">
      <PanelSiteFilter />
      <PanelPageHeader backHref="/panel" title={t("panel.navLinks")} />

      <LinksTabs siteId={site.id} socialUrls={socialUrls} otherLinks={links} />
    </div>
  );
}
