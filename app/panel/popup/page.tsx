import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { getPopupBanner } from "@/lib/actions/site-settings";
import { editingSite, listSites } from "@/lib/site-resolve";
import { SiteScopeNotice } from "@/components/site-scope-notice";
import { PopupForm } from "./popup-form";

export const metadata = { title: "Popup banner" };

export default async function PopupPage() {
  if (!(await requireAdmin())) redirect("/panel");

  const [site, sites] = await Promise.all([editingSite(), listSites()]);
  const popup = await getPopupBanner(site.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link href="/panel" className="text-sm text-[var(--muted)] transition-colors hover:text-foreground">
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Popup banner</h1>
      </div>

      <SiteScopeNotice host={site.host} name={site.name} siteCount={sites.length} />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        <PopupForm key={site.id} initial={popup} siteId={site.id} />
      </div>
    </div>
  );
}
