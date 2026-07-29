import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { getPanelPalette } from "@/lib/actions/site-settings";
import { AppearanceForm } from "./appearance-form";

export const metadata = { title: "Tampilan" };

export default async function AppearancePage() {
  if (!(await requireAdmin())) redirect("/panel");
  const palette = await getPanelPalette();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href="/panel"
          className="text-sm text-[var(--muted)] transition-colors hover:text-foreground"
        >
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Tampilan</h1>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Palet warna untuk <strong className="text-foreground">panel admin</strong>. Halaman
        publik dan halaman baca tidak ikut berubah — warna di sana menempel pada konversi,
        jadi dipisah dengan sengaja.
      </p>

      <AppearanceForm initial={palette} />
    </div>
  );
}
