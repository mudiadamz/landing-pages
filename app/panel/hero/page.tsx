import { redirect } from "next/navigation";
import { deniedPath } from "@/lib/panel-view";
import { requireFeature } from "@/lib/actions/profiles";
import { getHero } from "@/lib/actions/site-settings";
import { editingSite } from "@/lib/site-resolve";
import { PanelSiteFilter } from "@/components/panel-site-filter";
import { HeroForm } from "./hero-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export default async function HeroSettingsPage() {
  const t = translator(await requestLocale());
  const ok = await requireFeature("hero");
  if (!ok) redirect(deniedPath("hero"));

  // Which storefront's hero — not the host, which is always the canonical domain
  // here because the panel only runs there.
  const site = await editingSite();
  const hero = await getHero(site.id);

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.titleHero")} />

      <PanelSiteFilter />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <p className="text-sm text-[var(--muted)] mb-6">
          {t("panel.heroIntro")}{" "}
          <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">{t("panel.heroMarkHighlight")}</code>{" "}
          {t("panel.heroMarkHighlightWhat")}{" "}
          <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">{t("panel.heroMarkScript")}</code>{" "}
          {t("panel.heroMarkScriptWhat")}{" "}
          <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">{"{count}"}</code>{" "}
          {t("panel.heroMarkCount")}
        </p>
        {/* keyed on the site so switching resets the form to that site's values
            instead of keeping the previous one's in state */}
        <HeroForm key={site.id} initialHero={hero} siteId={site.id} />
      </div>
    </div>
  );
}
