import type { ReactNode } from "react";
import { AccountBottomNav, AccountTabs } from "@/components/account-nav";
import { PanelTopbar } from "@/components/panel-topbar";
import type { SiteBrand } from "@/lib/site-brand";
import type { Locale } from "@/lib/i18n";

/**
 * The panel shell for someone who only ever buys.
 *
 * `/panel` serves two audiences with almost nothing in common. A business
 * reaches twenty-six screens and needs a rail it can collapse, search and fold
 * into groups. A customer reaches four — overview, purchases, favourites,
 * profile — and putting those four in that rail told every buyer they had
 * wandered into the back office by mistake.
 *
 * So the shell splits, not the routes: the same pages render inside whichever
 * frame fits the person, and nothing has to move or be duplicated. The split is
 * decided once, in app/panel/layout.tsx, from the capabilities Fase 5 made
 * legible — anyone who can manage, sell, or has been delegated a single admin
 * feature keeps the sidebar.
 *
 * Deliberately NOT the storefront's own header/footer: those are per template
 * (default / linkbio / mbahgpt / pustaka), so "my purchases" would look like
 * four different pages depending on which domain you bought from.
 */
export function AccountShell({
  children,
  displayName,
  email,
  avatarUrl,
  brand,
  locale,
  canApplyBusiness,
  maySwitchView = false,
  banners,
}: {
  children: ReactNode;
  displayName: string;
  email: string | null;
  avatarUrl: string;
  brand: SiteBrand;
  locale: Locale;
  canApplyBusiness: boolean;
  /** True for a business person looking at their own account — offers the way back. */
  maySwitchView?: boolean;
  /** Email-verification notices — rendered by the caller, shown above the tabs. */
  banners?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PanelTopbar
        displayName={displayName}
        email={email}
        avatarUrl={avatarUrl}
        brand={brand}
        locale={locale}
        withSidebar={false}
        canApplyBusiness={canApplyBusiness}
        panelView="customer"
        maySwitchView={maySwitchView}
      />
      {banners}
      <div className="mx-auto w-full max-w-4xl flex-1 px-3 sm:px-6">
        <AccountTabs />
        {/* pb on phones clears the fixed bottom bar (h-14 + its safe-area
            padding); without it the last purchase in a long list sits under it. */}
        <main id="panel-main" className="min-w-0 py-6 pb-24 sm:py-8 sm:pb-8">
          {children}
        </main>
      </div>
      <AccountBottomNav />
    </div>
  );
}
