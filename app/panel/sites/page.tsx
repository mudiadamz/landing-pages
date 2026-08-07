import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { getCategories } from "@/lib/actions/landing-pages";
import { getSites } from "@/lib/actions/sites";
import { isCanonicalRequest, canonicalOrigin } from "@/lib/site-resolve";
import { SitesManager } from "./sites-manager";

export const metadata = { title: "Domain" };

export default async function SitesPage() {
  if (!(await requireAdmin())) redirect("/panel");

  // The panel lives on the canonical domain only. Supabase session cookies are
  // per-domain, so an admin screen on every storefront would mean a separate
  // login for each one — and this screen in particular could then be used from a
  // niche domain to rewrite the canonical domain's own host.
  if (!(await isCanonicalRequest())) redirect("/");

  const [sites, categories] = await Promise.all([getSites(), getCategories()]);
  const rootCategories = categories.filter((c) => !c.parent_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Domain</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Satu sistem, beberapa storefront. Tiap domain menampilkan kategori yang Anda pilih —
          produknya tidak diduplikasi, cukup satu katalog.
        </p>
      </div>

      <SitesManager
        sites={sites}
        rootCategories={rootCategories}
        canonicalOrigin={canonicalOrigin()}
      />
    </div>
  );
}
