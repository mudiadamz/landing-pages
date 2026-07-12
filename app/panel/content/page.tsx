import { redirect } from "next/navigation";
import Link from "next/link";
import { requireFeature } from "@/lib/actions/profiles";
import { getSiteContent } from "@/lib/actions/site-settings";
import { ContentForm } from "./content-form";

export default async function ContentSettingsPage() {
  const ok = await requireFeature("content");
  if (!ok) redirect("/panel");

  const content = await getSiteContent();

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

      <ContentForm initialContent={content} />
    </div>
  );
}
