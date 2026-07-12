import { createClient } from "@/lib/supabase/server";
import { getProfile, getAccessibleFeatures } from "@/lib/actions/profiles";
import { getPublisherApplications } from "@/lib/actions/admin";
import { PanelSidebar } from "@/components/panel-sidebar";
import { EmailConfirmBanner } from "@/components/email-confirm-banner";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [supabase, profile] = await Promise.all([
    createClient(),
    getProfile(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canSell = profile?.role === "admin" || profile?.role === "publisher";
  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "User";
  const emailConfirmed = !!user?.email_confirmed_at;

  // Feature access drives which admin areas appear in the nav.
  const features = await getAccessibleFeatures();

  // Pending admin actions (currently: publisher applications) → sidebar badge,
  // shown to anyone who can access the Users area.
  const pendingActions = features.includes("users") ? (await getPublisherApplications()).length : 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <PanelSidebar role={profile?.role} canSell={!!canSell} displayName={displayName} pendingActions={pendingActions} features={features} />
      <div className="flex flex-1 flex-col min-w-0">
        {!emailConfirmed && <EmailConfirmBanner />}
        <main className="flex-1 min-w-0 max-w-5xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 md:mx-0">
          {children}
        </main>
      </div>
    </div>
  );
}
