import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Daftar User</h1>
      <UsersTable />
    </div>
  );
}
