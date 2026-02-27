import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--card)]/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <nav className="flex items-center gap-1">
            <Link
              href="/panel"
              className="px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-[var(--background)] transition-colors"
            >
              Landing pages
            </Link>
            <Link
              href="/panel/upload"
              className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
            >
              Upload HTML
            </Link>
            <Link
              href="/panel/landing-pages/new"
              className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
            >
              New page
            </Link>
          </nav>
          <form action={signOut}>
            <button
              type="submit"
              className="px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:text-foreground hover:bg-[var(--background)] transition-colors"
            >
              Logout
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
