import { getProfile } from "@/lib/actions/profiles";
import { PanelSidebar } from "@/components/panel-sidebar";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin" || !profile;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <PanelSidebar isAdmin={!!isAdmin} />
      <main className="flex-1 min-w-0 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 md:mx-0">
        {children}
      </main>
    </div>
  );
}
