import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/db/server";
import { isCanonicalRequest, canonicalOrigin, currentSite } from "@/lib/site-resolve";
import { siteBrand } from "@/lib/site-brand";
import { getProfile, getAccessibleFeatures, canSellOnCurrentSite } from "@/lib/actions/profiles";
import { managesBusiness } from "@/lib/profile-utils";
import { getPanelPalette, getPanelSkin } from "@/lib/actions/site-settings";
import { paletteCss, surfaceCss, PANEL_SURFACES } from "@/lib/palette";
import { skinCss } from "@/lib/skin";
import { PanelSidebar } from "@/components/panel-sidebar";
import { PanelTopbar } from "@/components/panel-topbar";
import { PanelChrome } from "@/components/panel-chrome";
import { AccountShell } from "@/components/account-shell";
import { isCustomerOnly } from "@/lib/panel-shell";
import { PANEL_SIDEBAR_COOKIE, isSidebarCollapsed } from "@/lib/panel-chrome";
import { EmailConfirmBanner } from "@/components/email-confirm-banner";
import { EmailVerifyNotice } from "@/components/email-verify-notice";
import { LocaleProvider } from "@/lib/i18n/client";
import { requestLocale } from "@/lib/i18n/request";
import { translator } from "@/lib/i18n";

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

  const [db, profile, palette, panelSkin] = await Promise.all([
    createClient(),
    getProfile(),
    getPanelPalette(),
    getPanelSkin(),
  ]);
  const {
    data: { user },
  } = await db.auth.getUser();
  const canSell = await canSellOnCurrentSite();
  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "User";
  // Our own flag, not auth's — since signup stopped waiting for confirmation,
  // auth.users.email_confirmed_at is true for everyone and says nothing about
  // whether the address was ever proven.
  const emailVerified = !!profile?.email_verified_at;

  // Fase 4 signup: a plain customer (not the platform operator, not already tied
  // to a business) may apply to open one. Membership is the eligibility check —
  // the seeded owners/admins from the old model already have a row.
  //
  // Read off the profile rather than queried again here: getProfile() resolves
  // the membership once per request (Fase 5), and a second copy of this rule is
  // a second place for it to drift.
  const isBusinessManager = managesBusiness(profile?.business_role ?? null);
  const canApplyBusiness = !!user && !profile?.is_platform && !profile?.business_id;

  // Feature access drives which admin areas appear in the nav.
  const features = await getAccessibleFeatures();

  // No pending-action badge any more: the only queue it ever counted was
  // publisher applications, and those are gone. Business applications have their
  // own queue on /panel/platform, which only the Platform sees.
  const pendingActions = 0;

  // The panel-wide site scope, for the one switcher in the sidebar. Admins only, and
  // only the fields the switcher renders — the full row would ship template, palette and
  // both image URLs into the client bundle for nothing.
  const locale = await requestLocale();
  // Read here, not on the client: the sidebar width has to be right in the FIRST
  // paint, or every panel page opens 256px wide and snaps to 64px on hydration.
  const collapsed = isSidebarCollapsed((await cookies()).get(PANEL_SIDEBAR_COOKIE)?.value);
  const brand = siteBrand(await currentSite(), locale);

  // Which shell? The rule is in lib/panel-shell.ts, where it can be tested.
  const customerOnly = isCustomerOnly({
    isPlatform: !!profile?.is_platform,
    businessRole: profile?.business_role ?? null,
    canSell: !!canSell,
    featureCount: features.length,
  });

  const banners = (
    <>
      <EmailVerifyNotice />
      {user && !emailVerified && <EmailConfirmBanner email={user.email ?? null} />}
    </>
  );

  if (customerOnly) {
    return (
      <LocaleProvider locale={locale}>
        {/* Still inside PanelChrome: the topbar's account menu reads it, and the
            context costs nothing when there is no rail to drive. */}
        <PanelChrome defaultCollapsed={collapsed}>
          <style
            dangerouslySetInnerHTML={{ __html: skinCss(panelSkin) + paletteCss(palette) + surfaceCss(PANEL_SURFACES) }}
          />
          <AccountShell
            displayName={displayName}
            email={user?.email ?? null}
            avatarUrl={profile?.avatar_url ?? ""}
            brand={brand}
            locale={locale}
            canApplyBusiness={canApplyBusiness}
            banners={banners}
          >
            {children}
          </AccountShell>
        </PanelChrome>
      </LocaleProvider>
    );
  }

  return (
    <LocaleProvider locale={locale}>
    <PanelChrome defaultCollapsed={collapsed}>
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Skip link: keyboard users bypass the 26-item sidebar (WCAG 2.4.1). */}
      <a
        href="#panel-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:border focus:border-[var(--border)] focus:bg-[var(--card)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground"
      >
        {translator(locale)("panel.skipToContent")}
      </a>
      {/* Panel palette (/panel/appearance). Rendered here so it exists only on
          panel routes, but the selectors are :root / html.dark — dialogs portal
          to document.body, and a wrapper class would leave them uncoloured. */}
      {/* Panel palette, plus its OWN surfaces re-asserted. A storefront template
          may repaint --background/--card at :root (see registry `surfaces`), and
          on the canonical domain that style is on this page too — the admin UI
          should not inherit a storefront's page colour. */}
      <style
        dangerouslySetInnerHTML={{ __html: skinCss(panelSkin) + paletteCss(palette) + surfaceCss(PANEL_SURFACES) }}
      />
      <PanelSidebar
        isPlatform={!!profile?.is_platform}
        businessRole={profile?.business_role ?? null}
        canSell={!!canSell}
        canApplyBusiness={canApplyBusiness}
        isBusinessManager={isBusinessManager}
        pendingActions={pendingActions}
        features={features}
        brand={brand}
      />
      <div className="flex flex-1 flex-col min-w-0">
        {/* In the content pane, not across the window: the sidebar keeps its own
            full-height column, and the bar sits above the page it belongs to. */}
        <PanelTopbar
          displayName={displayName}
          email={user?.email ?? null}
          isPlatform={!!profile?.is_platform}
          businessRole={profile?.business_role ?? null}
          avatarUrl={profile?.avatar_url ?? ""}
          brand={brand}
          locale={locale}
        />
        {banners}
        <main id="panel-main" className="flex-1 min-w-0 max-w-5xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 md:mx-0">
          {children}
        </main>
      </div>
    </div>
    </PanelChrome>
    </LocaleProvider>
  );
}
