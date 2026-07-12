import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { getPublisherApplications } from "@/lib/actions/admin";
import { UsersTable } from "./users-table";
import { PublisherApplications } from "./publisher-applications";

export default async function UsersPage() {
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");

  const applications = await getPublisherApplications();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Daftar User</h1>
      <PublisherApplications initial={applications} />
      <UsersTable />
    </div>
  );
}
