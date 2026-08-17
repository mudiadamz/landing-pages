import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/actions/profiles";
import { getInvoiceById } from "@/lib/actions/purchases";
import { PrintButton } from "./print-button";
import { translator } from "@/lib/i18n";
import { SUPPORT_CONTACT } from "@/lib/constants";
import { requestLocale } from "@/lib/i18n/request";

type Props = { params: Promise<{ id: string }> };

function formatPrice(value: number): string {
  if (value === 0) return "Gratis";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function InvoiceDetailPage({ params }: Props) {
  const t = translator(await requestLocale());
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/panel"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          ← {t("common.back")}
        </Link>
        <PrintButton />
      </div>

      {/* Printable invoice card */}
      <div id="invoice" className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 print:border-0 print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-bold text-foreground">INVOICE</h1>
            <p className="text-sm text-[var(--muted)] mt-1 font-mono">
              {invoice.invoice_number ?? `#${invoice.id.slice(0, 8)}`}
            </p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="font-semibold text-foreground">ADM.UIUX</p>
            <p className="text-[var(--muted)]">{t("panel.invoiceTagline")}</p>
            <p className="text-[var(--muted)]">{SUPPORT_CONTACT.email}</p>
          </div>
        </div>

        {/* Customer + date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div>
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">{t("sales.customer")}</p>
            <p className="text-sm font-medium text-foreground">{invoice.user_name}</p>
            <p className="text-sm text-[var(--muted)]">{invoice.user_email}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">{t("panel.date")}</p>
            <p className="text-sm text-foreground">{formatDate(invoice.purchased_at)}</p>
            <p className="text-xs text-[var(--muted)] mt-1">
              {t("panel.invoiceMethod", { method: invoice.payment_method ?? "—" })}
            </p>
          </div>
        </div>

        {/* Line items */}
        <div className="border border-[var(--border)] rounded-xl overflow-hidden mb-6 print:border-gray-300">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--background)]/50 print:bg-gray-100">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">{t("panel.item")}</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted)]">{t("product.tabPrice")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--border)] print:border-gray-300">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{invoice.title}</p>
                  <p className="text-xs text-[var(--muted)]">{t("panel.tabProducts")}</p>
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground">
                  {formatPrice(invoice.amount)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border)] print:border-gray-400">
                <td className="px-4 py-3 font-semibold text-foreground">Total</td>
                <td className="px-4 py-3 text-right font-bold text-lg text-foreground">
                  {formatPrice(invoice.amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer note */}
        <div className="text-center text-xs text-[var(--muted)] print:text-gray-500">
          <p>{t("panel.invoiceThanks")}</p>
          <p className="mt-1">{t("panel.invoiceAuto")}</p>
        </div>
      </div>
    </div>
  );
}
