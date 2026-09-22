import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { getCategories } from "@/lib/actions/landing-pages";
import { isCanonicalRequest, canonicalOrigin, editingSite } from "@/lib/site-resolve";
import { templatePickerOptions } from "@/lib/templates/registry";
import { paletteOptions } from "@/lib/palette";
import { LOCALE_OPTIONS } from "@/lib/i18n/locales";
import { SiteWizard } from "./site-wizard";

export const metadata = { title: "Storefront baru" };

/**
 * Guided creation of a new storefront. Same gates as /panel/sites — Company only
 * (creating a site is non-delegable) and canonical-origin only, since this writes
 * a new lp_sites row. Everything the wizard needs is loaded here and passed as
 * serialisable props (the template registry also holds components, so only its
 * picker view can cross to the client).
 */
export default async function NewSitePage() {
  if (!(await requireAdmin())) redirect("/panel");
  if (!(await isCanonicalRequest())) redirect(`${canonicalOrigin()}/panel/sites/new`);

  const categories = await getCategories((await editingSite()).business_id);
  const rootCategories = categories.filter((c) => !c.parent_id);
  const canonicalHost = canonicalOrigin().replace(/^https?:\/\//, "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href="/panel/sites"
          className="text-sm text-[var(--muted)] transition-colors hover:text-foreground"
        >
          ← Daftar domain
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Storefront baru</h1>
      </div>

      <SiteWizard
        canonicalHost={canonicalHost}
        templates={templatePickerOptions()}
        palettes={paletteOptions()}
        locales={LOCALE_OPTIONS}
        rootCategories={rootCategories}
      />
    </div>
  );
}
