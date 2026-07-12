import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/actions/profiles";
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
  const isAdmin = profile?.role === "admin";
  const canSell = profile?.role === "admin" || profile?.role === "publisher";
  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "User";
  const emailConfirmed = !!user?.email_confirmed_at;

  // Pending admin actions (currently: publisher applications) → sidebar badge.
  const pendingActions = isAdmin ? (await getPublisherApplications()).length : 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <PanelSidebar isAdmin={!!isAdmin} canSell={!!canSell} displayName={displayName} pendingActions={pendingActions} />
      <div className="flex flex-1 flex-col min-w-0">
        {!emailConfirmed && <EmailConfirmBanner />}
        <main className="flex-1 min-w-0 max-w-5xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 md:mx-0">
          {children}
        </main>
      </div>
    </div>
  );
}
