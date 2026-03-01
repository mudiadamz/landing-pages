import Link from "next/link";

export default function LpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      {children}
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--card)]/95 backdrop-blur border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card)] active:scale-[0.98] active:opacity-90 shadow-lg transition-all duration-150"
        aria-label="Kembali ke beranda"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Kembali
      </Link>
    </div>
  );
}
