import Link from "next/link";
import { SocialLinks } from "@/components/social-links";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-[var(--border)] py-12 sm:py-16 shrink-0 overflow-hidden">
      <div
        className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--accent-cool) 0%, transparent 70%)" }}
        aria-hidden
      />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)] max-w-md">
              ADM.UIUX — landing page template gratis dan berbayar. By Adam Mudianto, software developer 15+ tahun.
            </p>
            <div>
              <p className="text-xs font-medium text-foreground mb-2">Sosial media</p>
              <SocialLinks variant="row" className="gap-x-4 gap-y-2 text-xs" />
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="/" className="inline-block text-[var(--muted)] hover:text-foreground transition-colors duration-200">
              Beranda
            </Link>
            <Link href="/about" className="inline-block text-[var(--muted)] hover:text-foreground transition-colors duration-200">
              Tentang
            </Link>
            <Link href="/contact" className="inline-block text-[var(--muted)] hover:text-foreground transition-colors duration-200">
              Kontak
            </Link>
            <Link href="/privacy" className="inline-block text-[var(--muted)] hover:text-foreground transition-colors duration-200">
              Kebijakan Privasi
            </Link>
            <Link href="/terms" className="inline-block text-[var(--muted)] hover:text-foreground transition-colors duration-200">
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
