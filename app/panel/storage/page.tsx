import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { listAllStorageFiles } from "@/lib/actions/storage-admin";
import { StorageManager } from "./storage-manager";

export const metadata = { title: "Storage" };

export default async function StoragePage() {
  if (!(await requireAdmin())) redirect("/panel");

  const { files, buckets, truncated, error } = await listAllStorageFiles();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link href="/panel" className="text-sm text-[var(--muted)] transition-colors hover:text-foreground">
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Storage</h1>
        <span className="w-fit rounded bg-[var(--background)] px-2 py-1 text-xs text-[var(--muted)]">
          semua file di Supabase Storage
        </span>
      </div>

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
