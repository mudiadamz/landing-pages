import { redirect } from "next/navigation";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import Link from "next/link";
import { requireSiteAdmin } from "@/lib/actions/profiles";
import { getCategories } from "@/lib/actions/landing-pages";
import { editingSite, listSites, isCanonicalRequest, canonicalOrigin } from "@/lib/site-resolve";
import { templatePickerOptions } from "@/lib/templates/registry";
import { paletteOptions } from "@/lib/palette";
import { LOCALE_OPTIONS } from "@/lib/i18n/locales";
import { SiteScopeNotice } from "@/components/site-scope-notice";
import { SiteProfileForm } from "./site-profile-form";

export async function generateMetadata() {
  return { title: translator(await requestLocale())("sites.identity") };
}

/**
 * The CONTENT half of a storefront: what it is called, what it looks like, and which
 * slice of the catalog it shows.
 *
 * Split out of /panel/sites, which now owns only the plumbing (hostname, Vercel, on
 * or off). Follows the same shape as the other per-domain settings screens — hero,
 * konten situs, tracking, popup, custom JS — so which storefront you are editing comes
 * from the panel-wide scope cookie set by the sidebar switcher, not from the host and
 * not from this screen.
 */
export default async function BrandingPage() {
  const t = translator(await requestLocale());
  if (!(await requireSiteAdmin())) redirect("/panel");

  // Same belt-and-braces guard as /panel/sites: this screen rewrites a site row, and
  // app/panel/layout.tsx already keeps admin routes on the canonical origin.
  if (!(await isCanonicalRequest())) redirect(`${canonicalOrigin()}/panel/branding`);

  const [site, sites, categories] = await Promise.all([
    editingSite(),
    listSites(),
    getCategories(),
  ]);
  const rootCategories = categories.filter((c) => !c.parent_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href="/panel/sites"
          className="text-sm text-[var(--muted)] transition-colors hover:text-foreground"
        >
          {t("panel.backToDomains")}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{t("sites.identityAndLook")}</h1>
      </div>

      <SiteScopeNotice host={site.host} name={site.name} siteCount={sites.length} />

      {/* Keyed on the site so switching resets the form to that site's values instead
          of keeping the previous one's in component state — the same reason the hero
          and popup forms are keyed. */}
      <SiteProfileForm
        key={site.id}
        siteId={site.id}
        host={site.host}
        initial={{
          name: site.name,
          tagline: site.tagline ?? "",
          description: site.description ?? "",
          categoryIds: site.category_ids ?? [],
          template: site.template || "default",
          palette: site.palette || "forest",
          locale: site.locale,
          logoUrl: site.logo_url ?? "",
          iconUrl: site.icon_url ?? "",
        }}
        rootCategories={rootCategories}
        // Serialisable view — the registry also holds components, which cannot cross
        // the server/client boundary as props.
        templates={templatePickerOptions()}
        palettes={paletteOptions()}
        locales={LOCALE_OPTIONS}
      />
    </div>
  );
}
