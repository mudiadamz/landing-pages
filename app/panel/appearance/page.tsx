import { redirect } from "next/navigation";
import { deniedPath } from "@/lib/panel-view";
import { requireAdmin } from "@/lib/actions/profiles";
import { getPanelPalette, getPanelSkin } from "@/lib/actions/site-settings";
import { AppearanceForm } from "./appearance-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export const metadata = { title: "Tampilan" };

export default async function AppearancePage() {
  const t = translator(await requestLocale());
  if (!(await requireAdmin())) redirect(deniedPath("appearance"));
  const [palette, skin] = await Promise.all([getPanelPalette(), getPanelSkin()]);

  return (
    <div className="space-y-5">
      <PanelPageHeader backHref="/panel" title={t("panel.navAppearance")} />

      <p className="text-sm text-[var(--muted)]">
        {t("panel.paletteForBefore")}{" "}
        <strong className="text-foreground">{t("panel.paletteForAdmin")}</strong>
        {t("panel.paletteForAfter")}
      </p>

      <AppearanceForm initial={palette} initialSkin={skin} />
    </div>
  );
}
