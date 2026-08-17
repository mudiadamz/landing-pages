import Link from "next/link";
import { redirect } from "next/navigation";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { canSellProducts } from "@/lib/actions/profiles";
import { UploadForm } from "../upload-form";

export default async function UploadPage() {
  const t = translator(await requestLocale());
  const canSell = await canSellProducts();
  if (!canSell) redirect("/panel");
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Link
          href="/panel"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          {t("panel.backShort")}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          {t("panel.uploadHtmlTitle")}
        </h1>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm">
        <UploadForm />
      </div>
    </div>
  );
}
