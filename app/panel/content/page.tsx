import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/actions/profiles";
import { getSiteContent } from "@/lib/actions/site-settings";
import { editingSite, listSites } from "@/lib/site-resolve";
import { SiteScopeNotice } from "@/components/site-scope-notice";
import { ContentForm } from "./content-form";
import { PanelPageHeader } from "@/components/panel-page-header";

export default async function ContentSettingsPage() {
  const ok = await requireFeature("content");
  if (!ok) redirect("/panel");

  const [site, sites] = await Promise.all([editingSite(), listSites()]);
  const content = await getSiteContent(site.id);

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title="Konten situs" />

      <p className="text-sm text-[var(--muted)]">
        Atur teks di footer dan bagian bawah homepage (ketentuan &amp; lisensi, cara pembelian,
        jaminan support, dan FAQ). Perubahan langsung tampil di semua halaman.
      </p>

      <SiteScopeNotice host={site.host} name={site.name} siteCount={sites.length} />

      <ContentForm key={site.id} initialContent={content} siteId={site.id} />
    </div>
  );
}
