"use client";

import { useState } from "react";
import Link from "next/link";
import type { PurchaseWithPage, InvoiceRow } from "@/lib/actions/purchases";
import type { UserReview } from "@/lib/actions/reviews";
import { ReviewForm } from "./review-form";

type Props = {
  purchases: PurchaseWithPage[];
  invoices: InvoiceRow[];
  reviews: UserReview[];
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

export function CustomerTabs({ purchases, invoices, reviews }: Props) {
  const [tab, setTab] = useState<"purchases" | "invoices">("purchases");

  const reviewMap = new Map<string, UserReview>();
  for (const r of reviews) {
    reviewMap.set(r.landing_page_id, r);
  }

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
        <PurchasesTab purchases={purchases} reviewMap={reviewMap} />
      ) : (
        <InvoicesTab invoices={invoices} />
      )}
    </>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} dari 5 bintang`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? "text-amber-500" : "text-[var(--border)]"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

function PurchasesTab({
  purchases,
  reviewMap,
}: {
  purchases: PurchaseWithPage[];
  reviewMap: Map<string, UserReview>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    <div className="space-y-3">
      {purchases.map((p) => {
        const review = reviewMap.get(p.landing_page_id);
        const isExpanded = expandedId === p.id;

        return (
          <div
            key={p.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{p.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{formatDate(p.purchased_at)}</p>
                </div>
                {review && <StarDisplay rating={review.rating} />}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
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
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="text-sm font-medium text-[var(--muted)] hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  {review ? "Edit review" : "Beri review"}
                </button>
              </div>

              {review?.review_text && !isExpanded && (
                <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2 italic">
                  &ldquo;{review.review_text}&rdquo;
                </p>
              )}
            </div>

            {isExpanded && (
              <div className="border-t border-[var(--border)] bg-[var(--background)]/50 p-4">
                <ReviewForm
                  landingPageId={p.landing_page_id}
                  existingRating={review?.rating ?? 0}
                  existingText={review?.review_text ?? ""}
                  onDone={() => setExpandedId(null)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
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
