import { createClient } from "@/lib/supabase/server";
import { getProfile, getAccessibleFeatures } from "@/lib/actions/profiles";
import { getPublisherApplications } from "@/lib/actions/admin";
import { getPanelPalette } from "@/lib/actions/site-settings";
import { paletteCss } from "@/lib/palette";
import { PanelSidebar } from "@/components/panel-sidebar";
import { EmailConfirmBanner } from "@/components/email-confirm-banner";
import { EmailVerifyNotice } from "@/components/email-verify-notice";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Panel palette (/panel/appearance). Rendered here so it exists only on
          panel routes, but the selectors are :root / html.dark — dialogs portal
          to document.body, and a wrapper class would leave them uncoloured. */}
      <style dangerouslySetInnerHTML={{ __html: paletteCss(palette) }} />
      <PanelSidebar role={profile?.role} canSell={!!canSell} displayName={displayName} pendingActions={pendingActions} features={features} />
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
