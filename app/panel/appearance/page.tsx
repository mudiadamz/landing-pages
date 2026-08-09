import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { getPanelPalette } from "@/lib/actions/site-settings";
import { AppearanceForm } from "./appearance-form";
import { PanelPageHeader } from "@/components/panel-page-header";

export const metadata = { title: "Tampilan" };

export default async function AppearancePage() {
  if (!(await requireAdmin())) redirect("/panel");
  const palette = await getPanelPalette();

  return (
    <div className="space-y-5">
      <PanelPageHeader backHref="/panel" title="Tampilan" />

      <p className="text-sm text-[var(--muted)]">
        Palet warna untuk <strong className="text-foreground">panel admin</strong>. Halaman
        publik dan halaman baca tidak ikut berubah — warna di sana menempel pada konversi,
        jadi dipisah dengan sengaja.
      </p>

      <AppearanceForm initial={palette} />
    </div>
  );
}
