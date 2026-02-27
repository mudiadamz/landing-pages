import { getProfile } from "@/lib/actions/profiles";
import { PanelHeader } from "@/components/panel-header";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin" || !profile;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PanelHeader isAdmin={!!isAdmin} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}
