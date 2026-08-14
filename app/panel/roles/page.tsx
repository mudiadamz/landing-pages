import { redirect } from "next/navigation";
import { requireAdmin, getRolePermissions } from "@/lib/actions/profiles";
import { RolesForm } from "./roles-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export default async function RolesPage() {
  const t = translator(await requestLocale());
  // Managing access is a superuser action — admins only, not delegatable.
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");

  const perms = await getRolePermissions();

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("panel.titleRoles")} />

      <p className="text-sm text-[var(--muted)]">
        Atur fitur admin mana yang bisa diakses tiap role. User mewarisi akses dari role-nya —
        ubah role user di halaman Users.
      </p>

      <RolesForm initial={perms} />
    </div>
  );
}
