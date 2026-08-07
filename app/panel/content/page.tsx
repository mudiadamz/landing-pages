import { redirect } from "next/navigation";
import Link from "next/link";
import { requireFeature } from "@/lib/actions/profiles";
import { getSiteContent } from "@/lib/actions/site-settings";
import { editingSite, listSites } from "@/lib/site-resolve";
import { SiteSwitcher } from "@/components/site-switcher";
import { ContentForm } from "./content-form";

export default async function ContentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string | string[] }>;
}) {
  const ok = await requireFeature("content");
  if (!ok) redirect("/panel");

  const { site: siteParam } = await searchParams;
  const [site, sites] = await Promise.all([editingSite(siteParam), listSites()]);
  const content = await getSiteContent(site.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Link
          href="/panel"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Konten situs</h1>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Atur teks di footer dan bagian bawah homepage (ketentuan &amp; lisensi, cara pembelian,
        jaminan support, dan FAQ). Perubahan langsung tampil di semua halaman.
      </p>

      <SiteSwitcher sites={sites} currentId={site.id} />

      <ContentForm key={site.id} initialContent={content} siteId={site.id} />
    </div>
  );
}
