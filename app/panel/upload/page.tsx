import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { UploadForm } from "../upload-form";

export default async function UploadPage() {
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/panel"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          ← Back
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          Upload HTML landing page
        </h1>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <UploadForm />
      </div>
    </div>
  );
}
