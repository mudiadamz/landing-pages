import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { listAllStorageFiles } from "@/lib/actions/storage-admin";
import { StorageManager } from "./storage-manager";
import { PanelPageHeader } from "@/components/panel-page-header";

export const metadata = { title: "Storage" };

export default async function StoragePage() {
  if (!(await requireAdmin())) redirect("/panel");

  const { files, buckets, truncated, error } = await listAllStorageFiles();

  return (
    <div className="space-y-6">
      <PanelPageHeader
        backHref="/panel"
        title="Storage"
        description="Semua file di Supabase Storage."
      />

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          Gagal memuat file: {error}
        </div>
      ) : (
        <StorageManager initialFiles={files} buckets={buckets} truncated={truncated} />
      )}
    </div>
  );
}
