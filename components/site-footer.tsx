import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] py-12 sm:py-16 shrink-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)] max-w-md">
              ADM.UIUX — landing page template gratis dan berbayar. By Adam Mudianto, software developer 15+ tahun.
            </p>
            <a
              href="https://lynk.id/adm.uiux"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:opacity-80 transition-opacity"
            >
              lynk.id/adm.uiux
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/" className="text-[var(--muted)] hover:text-foreground transition-colors">
              Beranda
            </Link>
            <Link href="/about" className="text-[var(--muted)] hover:text-foreground transition-colors">
              Tentang
            </Link>
            <Link href="/contact" className="text-[var(--muted)] hover:text-foreground transition-colors">
              Kontak
            </Link>
            <Link href="/privacy" className="text-[var(--muted)] hover:text-foreground transition-colors">
              Kebijakan Privasi
            </Link>
            <Link href="/terms" className="text-[var(--muted)] hover:text-foreground transition-colors">
              Ketentuan Layanan
            </Link>
          </nav>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--border)] text-center text-sm text-[var(--muted)]">
          © {new Date().getFullYear()} ADM.UIUX
        </div>
      </div>
    </footer>
  );
}
