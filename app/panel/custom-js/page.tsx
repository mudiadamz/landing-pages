import { redirect } from "next/navigation";
import Link from "next/link";
import { requireFeature } from "@/lib/actions/profiles";
import { getCustomJs } from "@/lib/actions/site-settings";
import { editingSite, listSites } from "@/lib/site-resolve";
import { SiteScopeNotice } from "@/components/site-scope-notice";
import { CustomJsForm } from "./custom-js-form";

export default async function CustomJsPage() {
  const ok = await requireFeature("custom-js");
  if (!ok) redirect("/panel");

  const [site, sites] = await Promise.all([editingSite(), listSites()]);
  const initialScript = await getCustomJs(site.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Link
          href="/panel"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Custom JavaScript</h1>
      </div>

      <SiteScopeNotice host={site.host} name={site.name} siteCount={sites.length} />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <p className="text-sm text-[var(--muted)] mb-4">
          Skrip ini diinjeksi ke setiap halaman situs (termasuk publik). Gunakan untuk analytics, tracking, atau kode tambahan.
        </p>
        <CustomJsForm key={site.id} initialScript={initialScript} siteId={site.id} />
      </div>
    </div>
  );
}
