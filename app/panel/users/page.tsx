import { redirect } from "next/navigation";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { requireFeature, requireAdmin, requireSiteAdmin } from "@/lib/actions/profiles";
import { editingSite, listSites } from "@/lib/site-resolve";
import { getPublisherApplications } from "@/lib/actions/admin";
import { UsersTable } from "./users-table";
import { PublisherApplications } from "./publisher-applications";

export default async function UsersPage() {
  const t = translator(await requestLocale());
  const ok = await requireFeature("users");
  if (!ok) redirect("/panel");

  // Tiga hal berbeda, sengaja dipisah:
  //   isAdmin      platform — boleh ubah role platform, paket, ban, hapus akun
  //   isSiteAdmin  situs ini — boleh kelola keanggotaannya
  //   site         situs yang sedang dilihat, untuk judulnya
  const [isAdmin, isSiteAdmin, site, sites, applications] = await Promise.all([
    requireAdmin(),
    requireSiteAdmin(),
    editingSite(),
    listSites(),
    getPublisherApplications(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("panel.userList")}</h1>
        {sites.length > 1 && (
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t("panel.usersScopeHint", { host: site.host })}
          </p>
        )}
      </div>
      <PublisherApplications initial={applications} />
      <UsersTable isAdmin={isAdmin} isSiteAdmin={isSiteAdmin} multiSite={sites.length > 1} />
    </div>
  );
}
