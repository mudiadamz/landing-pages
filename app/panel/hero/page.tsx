import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/actions/profiles";
import { getHero } from "@/lib/actions/site-settings";
import { editingSite, listSites } from "@/lib/site-resolve";
import { SiteScopeNotice } from "@/components/site-scope-notice";
import { HeroForm } from "./hero-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export default async function HeroSettingsPage() {
  const t = translator(await requestLocale());
  const ok = await requireFeature("hero");
  if (!ok) redirect("/panel");

  // Which storefront's hero — not the host, which is always the canonical domain
  // here because the panel only runs there.
  const [site, sites] = await Promise.all([editingSite(), listSites()]);
  const hero = await getHero(site.id);

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.titleHero")} />

      <SiteScopeNotice host={site.host} name={site.name} siteCount={sites.length} />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <p className="text-sm text-[var(--muted)] mb-6">
          Atur konten bagian hero di homepage. Gunakan{" "}
          <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">*teks*</code> untuk sorotan hijau dan{" "}
          <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">~teks~</code> untuk aksen tulisan tangan.
          Tulis <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">{"{count}"}</code> pada badge untuk menampilkan jumlah produk otomatis.
        </p>
        {/* keyed on the site so switching resets the form to that site's values
            instead of keeping the previous one's in state */}
        <HeroForm key={site.id} initialHero={hero} siteId={site.id} />
      </div>
    </div>
  );
}
