import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { NewPageForm } from "./new-page-form";

export default async function NewPagePage() {
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Link
          href="/panel"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">New landing page</h1>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm">
        <NewPageForm />
      </div>
    </div>
  );
}
