import Link from "next/link";

/**
 * Local payment methods accepted via Duitku. Rendered as honest text pills
 * (no trademarked logo assets shipped) — swap in real logos later if desired.
 * The familiarity cue counters new-store scam fear for Indonesian buyers.
 */
const PAYMENT_METHODS = ["QRIS", "GoPay", "DANA", "ShopeePay", "OVO", "VA BCA/Mandiri"];

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

/**
 * Founder-voiced 7-day money-back guarantee, promoted from a muted footnote to a
 * bordered badge placed at the hesitation point (right above the buy CTA). On a
 * low-review store this is the strongest social-proof substitute.
 */
export function GuaranteeBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-3 ${className}`}
    >
      <ShieldCheckIcon className="w-5 h-5 shrink-0 text-[var(--primary)] mt-0.5" />
      <p className="text-xs text-foreground leading-relaxed">
        <span className="font-semibold">Garansi 7 hari uang kembali.</span> Nggak cocok atau
        file bermasalah? Aku perbaiki atau kembalikan dana — dijamin langsung oleh Adam.{" "}
        <Link href="/refund" className="text-[var(--primary)] hover:underline font-medium">
          Selengkapnya
        </Link>
      </p>
    </div>
  );
}

/**
 * Row of accepted payment methods + a "secure via Duitku" cue. A primary
 * Indonesian trust signal; place it directly under the buy CTA.
 */
export function PaymentMethodsRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
        <LockIcon className="w-3.5 h-3.5 text-[var(--primary)]" />
        Pembayaran aman lewat Duitku
      </span>
      <span className="flex flex-wrap justify-center gap-1">
        {PAYMENT_METHODS.map((m) => (
          <span
            key={m}
            className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[var(--muted)] bg-[var(--accent-subtle)] border border-[var(--border)]"
          >
            {m}
          </span>
        ))}
      </span>
    </div>
  );
}
