import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { listLibraryAssets } from "@/lib/actions/assets";
import { AssetsBrowser } from "./assets-browser";

export default async function AssetsPage() {
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");

  const assets = await listLibraryAssets();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Link
          href="/panel/products"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Assets</h1>
      </div>

      <AssetsBrowser initialAssets={assets} />
    </div>
  );
}
