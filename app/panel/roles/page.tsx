import { redirect } from "next/navigation";
import { requireSiteAdmin, getRolePermissions } from "@/lib/actions/profiles";
import { editingSite, listSites } from "@/lib/site-resolve";
import { RolesForm } from "./roles-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export default async function RolesPage() {
  const t = translator(await requestLocale());
  // Per-situs sejak fase 6: admin sebuah situs mengatur delegasi di situsnya
  // sendiri. Tetap bukan hal yang bisa didelegasikan lebih jauh — requireFeature
  // tidak dipakai di sini, hanya kepemilikan situs.
  const [isSiteAdmin, site, sites] = await Promise.all([
    requireSiteAdmin(),
    editingSite(),
    listSites(),
  ]);
  if (!isSiteAdmin) redirect("/panel");

  const perms = await getRolePermissions(site.id);

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.titleRoles")} />

      <p className="text-sm text-[var(--muted)]">
        {t("panel.rolesIntro")}
        {sites.length > 1 && (
          <>
            {" "}
            <span className="text-foreground">{site.host}</span>
          </>
        )}
      </p>

      <RolesForm initial={perms} />
    </div>
  );
}
