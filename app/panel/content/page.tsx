import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/actions/profiles";
import { getSiteContent } from "@/lib/actions/site-settings";
import { editingSite } from "@/lib/site-resolve";
import { PanelSiteFilter } from "@/components/panel-site-filter";
import { ContentForm } from "./content-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export async function generateMetadata() {
  return { title: translator(await requestLocale())("panel.navContent") };
}

export default async function ContentSettingsPage() {
  const t = translator(await requestLocale());
  const ok = await requireFeature("content");
  if (!ok) redirect("/panel");

  const site = await editingSite();
  const content = await getSiteContent(site.id);

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.navContent")} />

      <p className="text-sm text-[var(--muted)]">
        Atur teks di footer dan bagian bawah homepage (ketentuan &amp; lisensi, cara pembelian,
        jaminan support, dan FAQ). Perubahan langsung tampil di semua halaman.
      </p>

      <PanelSiteFilter />

      <ContentForm key={site.id} initialContent={content} siteId={site.id} />
    </div>
  );
}
