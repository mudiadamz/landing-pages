import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/actions/profiles";
import { PanelSidebar } from "@/components/panel-sidebar";
import { EmailConfirmBanner } from "@/components/email-confirm-banner";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin" || !profile;
  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "User";
  const emailConfirmed = !!user?.email_confirmed_at;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <PanelSidebar isAdmin={!!isAdmin} displayName={displayName} />
      <div className="flex flex-1 flex-col min-w-0">
        {!emailConfirmed && <EmailConfirmBanner />}
        <main className="flex-1 min-w-0 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 md:mx-0">
          {children}
        </main>
      </div>
    </div>
  );
}
