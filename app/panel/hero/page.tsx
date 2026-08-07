import { redirect } from "next/navigation";
import Link from "next/link";
import { requireFeature } from "@/lib/actions/profiles";
import { getHero } from "@/lib/actions/site-settings";
import { editingSite, listSites } from "@/lib/site-resolve";
import { SiteSwitcher } from "@/components/site-switcher";
import { HeroForm } from "./hero-form";

export default async function HeroSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string | string[] }>;
}) {
  const ok = await requireFeature("hero");
  if (!ok) redirect("/panel");

  // Which storefront's hero — not the host, which is always the canonical domain
  // here because the panel only runs there.
  const { site: siteParam } = await searchParams;
  const [site, sites] = await Promise.all([editingSite(siteParam), listSites()]);
  const hero = await getHero(site.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Link
          href="/panel"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Hero halaman utama</h1>
      </div>

      <SiteSwitcher sites={sites} currentId={site.id} />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <p className="text-sm text-[var(--muted)] mb-6">
          Atur konten bagian hero di homepage. Gunakan{" "}
          <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">*teks*</code> untuk sorotan hijau dan{" "}
          <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">~teks~</code> untuk aksen tulisan tangan.
          Tulis <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">{"{count}"}</code> pada badge untuk menampilkan jumlah produk otomatis.
        </p>
        {/* keyed on the site so switching resets the form to that site's values
            instead of keeping the previous one's in state */}
        <HeroForm key={site.id} initialHero={hero} siteId={site.id} />
      </div>
    </div>
  );
}
