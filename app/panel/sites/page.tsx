import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { getCategories } from "@/lib/actions/landing-pages";
import { getSites, isVercelConfigured } from "@/lib/actions/sites";
import { isCanonicalRequest, canonicalOrigin } from "@/lib/site-resolve";
import { templatePickerOptions } from "@/lib/templates/registry";
import { paletteOptions } from "@/lib/palette";
import { SitesManager } from "./sites-manager";

export const metadata = { title: "Domain" };

export default async function SitesPage() {
  if (!(await requireAdmin())) redirect("/panel");

  // Belt and braces: app/panel/layout.tsx already sends admin routes on a niche
  // domain to the canonical origin, so this normally never fires. Kept because this
  // screen in particular could otherwise be used from a niche domain to rewrite the
  // canonical domain's own host — a guard worth having twice.
  if (!(await isCanonicalRequest())) redirect(`${canonicalOrigin()}/panel/sites`);

  const [sites, categories, vercelAutomated] = await Promise.all([
    getSites(),
    getCategories(),
    isVercelConfigured(),
  ]);
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
        canonicalHost={canonicalOrigin().replace(/^https?:\/\//, "")}
        // Public anyway (it ships to the browser as a NEXT_PUBLIC var) and needed
        // verbatim: it is the one redirect URI Google is configured with.
        supabaseProjectUrl={(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}
        vercelAutomated={vercelAutomated}
        // Serialisable view — the registry also holds components, which cannot cross
        // the server/client boundary as props.
        templates={templatePickerOptions()}
        palettes={paletteOptions()}
      />
    </div>
  );
}
