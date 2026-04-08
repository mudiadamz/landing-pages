"use client";

import { useState } from "react";
import Link from "next/link";
import type { PurchaseWithPage, InvoiceRow } from "@/lib/actions/purchases";

type Props = {
  purchases: PurchaseWithPage[];
  invoices: InvoiceRow[];
};

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(value: number): string {
  if (value === 0) return "Gratis";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CustomerTabs({ purchases, invoices }: Props) {
  const [tab, setTab] = useState<"purchases" | "invoices">("purchases");

  return (
    <>
      <div className="flex gap-1 p-1 rounded-lg bg-[var(--background)] border border-[var(--border)] w-fit">
        <button
          type="button"
          onClick={() => setTab("purchases")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "purchases"
              ? "bg-[var(--card)] text-foreground shadow-sm"
              : "text-[var(--muted)] hover:text-foreground"
          }`}
        >
          Landing Page
        </button>
        <button
          type="button"
          onClick={() => setTab("invoices")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "invoices"
              ? "bg-[var(--card)] text-foreground shadow-sm"
              : "text-[var(--muted)] hover:text-foreground"
          }`}
        >
          Riwayat & Invoice
        </button>
      </div>

      {tab === "purchases" ? (
        <PurchasesTab purchases={purchases} />
      ) : (
        <InvoicesTab invoices={invoices} />
      )}
    </>
  );
}

function PurchasesTab({ purchases }: { purchases: PurchaseWithPage[] }) {
  if (purchases.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
        <p className="text-[var(--muted)]">Belum ada pembelian landing page.</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-[var(--primary)] hover:underline"
        >
          Jelajahi landing page
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {purchases.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
          >
            <p className="font-medium text-foreground truncate">{p.title}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{formatDate(p.purchased_at)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/lp/${p.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--primary)] hover:underline"
              >
                Lihat
              </Link>
              {p.zip_url && (
                <Link
                  href={`/api/download/${p.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[var(--primary)] hover:underline"
                >
                  Download ZIP
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Judul</th>
                <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Dibeli</th>
                <th className="px-4 py-3.5 text-right text-sm font-medium text-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors"
                >
                  <td className="px-4 py-3.5 font-medium text-foreground">{p.title}</td>
                  <td className="px-4 py-3.5 text-sm text-[var(--muted)]">{formatDate(p.purchased_at)}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="inline-flex gap-3">
                      <Link
                        href={`/lp/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-[var(--primary)] hover:underline"
                      >
                        Lihat
                      </Link>
                      {p.zip_url && (
                        <Link
                          href={`/api/download/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[var(--primary)] hover:underline"
                        >
                          Download
                        </Link>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function InvoicesTab({ invoices }: { invoices: InvoiceRow[] }) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
        <p className="text-[var(--muted)]">Belum ada riwayat pembelian.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Produk</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Tanggal</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted)]">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-[var(--muted)]">Metode</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                    {inv.invoice_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{inv.title}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDate(inv.purchased_at)}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {formatPrice(inv.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent-subtle)] text-[var(--muted)]">
                      {inv.payment_method ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/panel/invoices/${inv.id}`}
                      className="text-xs font-medium text-[var(--primary)] hover:underline"
                    >
                      Lihat
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {invoices.map((inv) => (
          <Link
            key={inv.id}
            href={`/panel/invoices/${inv.id}`}
            className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm hover:bg-[var(--background)]/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">{inv.title}</span>
              <span className="text-sm font-medium text-foreground">
                {formatPrice(inv.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">
                {inv.invoice_number ?? "—"} · {formatDate(inv.purchased_at)}
              </span>
              <span className="text-xs text-[var(--primary)]">Lihat →</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
