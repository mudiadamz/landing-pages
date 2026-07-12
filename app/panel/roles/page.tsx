import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin, getRolePermissions } from "@/lib/actions/profiles";
import { RolesForm } from "./roles-form";

export default async function RolesPage() {
  // Managing access is a superuser action — admins only, not delegatable.
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");

  const perms = await getRolePermissions();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Link href="/panel" className="text-sm text-[var(--muted)] hover:text-foreground transition-colors">
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Roles &amp; akses</h1>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Atur fitur admin mana yang bisa diakses tiap role. User mewarisi akses dari role-nya —
        ubah role user di halaman Users.
      </p>

      <RolesForm initial={perms} />
    </div>
  );
}
