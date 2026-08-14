import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { getPanelPalette } from "@/lib/actions/site-settings";
import { AppearanceForm } from "./appearance-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export const metadata = { title: "Tampilan" };

export default async function AppearancePage() {
  const t = translator(await requestLocale());
  if (!(await requireAdmin())) redirect("/panel");
  const palette = await getPanelPalette();

  return (
    <div className="space-y-5">
      <PanelPageHeader backHref="/panel" title={t("panel.navAppearance")} />

      <p className="text-sm text-[var(--muted)]">
        Palet warna untuk <strong className="text-foreground">panel admin</strong>. Halaman
        publik dan halaman baca tidak ikut berubah — warna di sana menempel pada konversi,
        jadi dipisah dengan sengaja.
      </p>

      <AppearanceForm initial={palette} />
    </div>
  );
}
