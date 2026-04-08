import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/actions/profiles";
import { getInvoiceById } from "@/lib/actions/purchases";
import { PrintButton } from "./print-button";

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
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/panel/invoices"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          ← Kembali
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
            <p className="text-[var(--muted)]">Landing Page & Digital Assets</p>
            <p className="text-[var(--muted)]">admin@admuiux.com</p>
          </div>
        </div>

        {/* Customer + date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div>
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">Pelanggan</p>
            <p className="text-sm font-medium text-foreground">{invoice.user_name}</p>
            <p className="text-sm text-[var(--muted)]">{invoice.user_email}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">Tanggal</p>
            <p className="text-sm text-foreground">{formatDate(invoice.purchased_at)}</p>
            <p className="text-xs text-[var(--muted)] mt-1">
              Metode: {invoice.payment_method ?? "—"}
            </p>
          </div>
        </div>

        {/* Line items */}
        <div className="border border-[var(--border)] rounded-xl overflow-hidden mb-6 print:border-gray-300">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--background)]/50 print:bg-gray-100">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Item</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted)]">Harga</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--border)] print:border-gray-300">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{invoice.title}</p>
                  <p className="text-xs text-[var(--muted)]">Landing Page</p>
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
          <p>Terima kasih atas pembelian Anda.</p>
          <p className="mt-1">Invoice ini dibuat secara otomatis oleh sistem ADM.UIUX.</p>
        </div>
      </div>
    </div>
  );
}
