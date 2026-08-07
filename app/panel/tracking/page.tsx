import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { getTracking } from "@/lib/actions/site-settings";
import { editingSite, listSites } from "@/lib/site-resolve";
import { SiteSwitcher } from "@/components/site-switcher";
import { TrackingForm } from "./tracking-form";

export const metadata = { title: "Tracking" };

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string | string[] }>;
}) {
  if (!(await requireAdmin())) redirect("/panel");

  const { site: siteParam } = await searchParams;
  const [site, sites] = await Promise.all([editingSite(siteParam), listSites()]);
  const tracking = await getTracking(site.id);
  const fromEnv = !!process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link href="/panel" className="text-sm text-[var(--muted)] transition-colors hover:text-foreground">
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Tracking</h1>
      </div>

      <SiteSwitcher sites={sites} currentId={site.id} />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">Google Tag Manager</h2>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          Masukkan ID container GTM (format <code className="rounded bg-[var(--background)] px-1">GTM-XXXXXXX</code>).
          Skrip GTM dimuat di semua halaman publik (di-skip di /panel). Dari GTM kamu bisa mengelola GA4, Meta
          Pixel, dan tag lain tanpa mengubah kode.
        </p>
        <TrackingForm key={site.id} initialGtmId={tracking.gtmId} siteId={site.id} />
        {fromEnv && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Catatan: <code className="rounded bg-[var(--background)] px-1">NEXT_PUBLIC_GTM_ID</code> diset di
            environment — dipakai sebagai fallback bila field ini dikosongkan.
          </p>
        )}
      </div>
    </div>
  );
}
