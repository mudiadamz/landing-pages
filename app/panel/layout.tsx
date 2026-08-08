import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isCanonicalRequest, canonicalOrigin, currentSite, editingSite, listSites } from "@/lib/site-resolve";
import { siteBrand } from "@/lib/site-brand";
import { getProfile, getAccessibleFeatures } from "@/lib/actions/profiles";
import { getPublisherApplications } from "@/lib/actions/admin";
import { getPanelPalette } from "@/lib/actions/site-settings";
import { paletteCss } from "@/lib/palette";
import { PanelSidebar } from "@/components/panel-sidebar";
import { EmailConfirmBanner } from "@/components/email-confirm-banner";
import { EmailVerifyNotice } from "@/components/email-verify-notice";

/**
 * Panel routes a CUSTOMER needs, so they work on every storefront.
 *
 * An allowlist, not a blocklist of admin routes: a new admin screen added later
 * must default to canonical-only. Getting that backwards would quietly expose the
 * next admin surface on every domain.
 */
/**
 * The dashboard, matched EXACTLY. It cannot be a prefix: "/panel" as a prefix
 * matches "/panel/anything", which would have allowed every admin screen on every
 * domain — an allowlist that lets everything through. Caught by testing the
 * classifier against real paths rather than eyeballing it.
 */
const CUSTOMER_PANEL_EXACT = ["/panel"];

/** Sub-trees a customer owns; these match themselves and anything beneath them. */
const CUSTOMER_PANEL_PREFIXES = [
  "/panel/purchases",
  "/panel/favorites",
  "/panel/invoices",
  "/panel/profile",
  "/panel/publisher", // applying to become a seller
];

function isCustomerPanelPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/panel";
  if (CUSTOMER_PANEL_EXACT.includes(clean)) return true;
  // `${p}/` and not startsWith(p), so /panel/purchasesX doesn't ride in on
  // /panel/purchases.
  return CUSTOMER_PANEL_PREFIXES.some((p) => clean === p || clean.startsWith(`${p}/`));
}

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // /panel is not an admin area — it is a MIXED one. Customers read "Pembelian
  // saya", their invoices and favourites here, and because Supabase session
  // cookies never cross domains, a buyer's session exists only on the domain they
  // bought from. Blocking /panel per-domain therefore stranded them: no purchases
  // on the storefront they used, and no session on the canonical one.
  //
  // So the customer routes serve everywhere, and only the admin surfaces stay
  // canonical (one admin login instead of one per storefront). An admin route hit
  // on a niche domain redirects to the SAME path on the canonical origin, which is
  // where their session already is.
  if (!(await isCanonicalRequest())) {
    const pathname = (await headers()).get("x-pathname") ?? "/panel";
    if (!isCustomerPanelPath(pathname)) {
      redirect(`${canonicalOrigin()}${pathname}`);
    }
  }

  const [supabase, profile, palette] = await Promise.all([
    createClient(),
    getProfile(),
    getPanelPalette(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canSell = profile?.role === "admin" || profile?.role === "publisher";
  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "User";
  // Our own flag, not auth's — since signup stopped waiting for confirmation,
  // auth.users.email_confirmed_at is true for everyone and says nothing about
  // whether the address was ever proven.
  const emailVerified = !!profile?.email_verified_at;

  // Feature access drives which admin areas appear in the nav.
  const features = await getAccessibleFeatures();

  // Pending admin actions (currently: publisher applications) → sidebar badge,
  // shown to anyone who can access the Users area.
  const pendingActions = features.includes("users") ? (await getPublisherApplications()).length : 0;

  // The panel-wide site scope, for the one switcher in the sidebar. Admins only, and
  // only the fields the switcher renders — the full row would ship template, palette and
  // both image URLs into the client bundle for nothing.
  const isAdmin = profile?.role === "admin";
  const [allSites, scopedSite] = isAdmin
    ? await Promise.all([listSites(), editingSite()])
    : [[], null];
  const siteOptions = allSites.map((s) => ({
    id: s.id,
    host: s.host,
    name: s.name,
    is_canonical: s.is_canonical,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Panel palette (/panel/appearance). Rendered here so it exists only on
          panel routes, but the selectors are :root / html.dark — dialogs portal
          to document.body, and a wrapper class would leave them uncoloured. */}
      <style dangerouslySetInnerHTML={{ __html: paletteCss(palette) }} />
      <PanelSidebar
        role={profile?.role}
        canSell={!!canSell}
        displayName={displayName}
        pendingActions={pendingActions}
        features={features}
        sites={siteOptions}
        editingSiteId={scopedSite?.id ?? ""}
        brand={siteBrand(await currentSite())}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <EmailVerifyNotice />
        {user && !emailVerified && <EmailConfirmBanner email={user.email ?? null} />}
        <main className="flex-1 min-w-0 max-w-5xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 md:mx-0">
          {children}
        </main>
      </div>
    </div>
  );
}
