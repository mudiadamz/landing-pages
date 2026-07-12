import { redirect } from "next/navigation";
import { requireFeature, requireAdmin } from "@/lib/actions/profiles";
import { getPublisherApplications } from "@/lib/actions/admin";
import { UsersTable } from "./users-table";
import { PublisherApplications } from "./publisher-applications";

export default async function UsersPage() {
  const ok = await requireFeature("users");
  if (!ok) redirect("/panel");

  // Only a full admin may change roles; delegates with the "users" feature can
  // view + ban/unban.
  const isAdmin = await requireAdmin();
  const applications = await getPublisherApplications();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Daftar User</h1>
      <PublisherApplications initial={applications} />
      <UsersTable isAdmin={isAdmin} />
    </div>
  );
}
