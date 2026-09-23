import { redirect } from "next/navigation";
import { PanelSiteFilter } from "@/components/panel-site-filter";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { requireFeature, requireAdmin, requireSiteAdmin } from "@/lib/actions/profiles";
import { editingSite } from "@/lib/site-resolve";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const t = translator(await requestLocale());
  const ok = await requireFeature("users");
  if (!ok) redirect("/panel");

  // Tiga hal berbeda, sengaja dipisah:
  //   isAdmin      platform — boleh ubah role platform, paket, ban, hapus akun
  //   isSiteAdmin  situs ini — boleh kelola keanggotaannya
  //   site         situs yang sedang dilihat, untuk judulnya
  const [isAdmin, isSiteAdmin, site] = await Promise.all([
    requireAdmin(),
    requireSiteAdmin(),
    editingSite(),
  ]);

  return (
    <div className="space-y-6">
      <PanelSiteFilter />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("panel.userList")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {site.host
            ? t("panel.usersScopeHint", { host: site.host })
            : t("panel.usersScopeHintNoSite")}
        </p>
      </div>
      <UsersTable isAdmin={isAdmin} isSiteAdmin={isSiteAdmin} />
    </div>
  );
}
