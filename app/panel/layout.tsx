import Link from "next/link";
import { signOut } from "@/lib/actions/auth";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-foreground/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link
              href="/panel"
              className="font-medium text-foreground hover:underline"
            >
              Landing pages
            </Link>
            <Link
              href="/panel/upload"
              className="text-foreground/80 hover:text-foreground"
            >
              Upload HTML
            </Link>
            <Link
              href="/panel/landing-pages/new"
              className="text-foreground/80 hover:text-foreground"
            >
              New page
            </Link>
          </nav>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Logout
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
