import { redirect } from "next/navigation";
import { requireAdmin, getRolePermissions } from "@/lib/actions/profiles";
import { RolesForm } from "./roles-form";
import { PanelPageHeader } from "@/components/panel-page-header";

export default async function RolesPage() {
  // Managing access is a superuser action — admins only, not delegatable.
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");

  const perms = await getRolePermissions();

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title="Roles &amp; akses" />

      <p className="text-sm text-[var(--muted)]">
        Atur fitur admin mana yang bisa diakses tiap role. User mewarisi akses dari role-nya —
        ubah role user di halaman Users.
      </p>

      <RolesForm initial={perms} />
    </div>
  );
}
