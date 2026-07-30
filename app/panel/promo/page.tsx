import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { getPromoPopup } from "@/lib/actions/site-settings";
import { PromoForm } from "./promo-form";

export const metadata = { title: "Promo" };

export default async function PromoPage() {
  if (!(await requireAdmin())) redirect("/panel");
  const promo = await getPromoPopup();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link href="/panel" className="text-sm text-[var(--muted)] transition-colors hover:text-foreground">
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Popup promo</h1>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        <PromoForm initial={promo} />
      </div>
    </div>
  );
}
