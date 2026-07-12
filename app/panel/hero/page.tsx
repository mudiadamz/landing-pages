import { redirect } from "next/navigation";
import Link from "next/link";
import { requireFeature } from "@/lib/actions/profiles";
import { getHero } from "@/lib/actions/site-settings";
import { HeroForm } from "./hero-form";

export default async function HeroSettingsPage() {
  const ok = await requireFeature("hero");
  if (!ok) redirect("/panel");

  const hero = await getHero();

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

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <p className="text-sm text-[var(--muted)] mb-6">
          Atur konten bagian hero di homepage. Gunakan{" "}
          <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">*teks*</code> untuk sorotan hijau dan{" "}
          <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">~teks~</code> untuk aksen tulisan tangan.
          Tulis <code className="px-1 rounded bg-[var(--accent-subtle)] text-foreground">{"{count}"}</code> pada badge untuk menampilkan jumlah produk otomatis.
        </p>
        <HeroForm initialHero={hero} />
      </div>
    </div>
  );
}
