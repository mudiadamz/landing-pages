import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/actions/profiles";
import { getLandingPagesForUser } from "@/lib/actions/landing-pages";
import { getPurchasesForUser } from "@/lib/actions/purchases";
import { DeleteButton } from "./delete-button";

export default async function PanelPage() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin" || !profile;

  if (!isAdmin) {
    return <CustomerPanel />;
  }

  return <AdminPanel />;
}

async function CustomerPanel() {
  const purchases = await getPurchasesForUser();

  function formatDate(s: string) {
    return new Date(s).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Pembelian saya</h1>

      {purchases.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
          <p className="text-[var(--muted)]">Belum ada pembelian landing page.</p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-[var(--primary)] hover:underline"
          >
            Jelajahi landing page
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-3">
            {purchases.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <p className="font-medium text-foreground truncate">{p.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{formatDate(p.purchased_at)}</p>
                <Link
                  href={`/lp/${p.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline"
                >
                  Lihat →
                </Link>
              </div>
            ))}
          </div>
          {/* Desktop: table */}
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
                        <Link
                          href={`/lp/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[var(--primary)] hover:underline"
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
        </>
      )}
    </div>
  );
}

async function AdminPanel() {
  const pages = await getLandingPagesForUser();

  function formatDate(s: string) {
    return new Date(s).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Landing pages</h1>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
          <p className="text-sm text-[var(--muted)]">Belum ada landing page. Upload file HTML atau buat halaman baru.</p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-3">
            {pages.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <p className="font-medium text-foreground truncate">{p.title}</p>
                <p className="font-mono text-xs text-[var(--muted)] truncate">{p.slug}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(p.updated_at)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/panel/landing-pages/${p.id}/edit`}
                    className="text-sm font-medium text-[var(--primary)] hover:underline"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/lp/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-[var(--primary)] hover:underline"
                  >
                    Lihat
                  </Link>
                  <DeleteButton id={p.id} />
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: table */}
          <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Judul</th>
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Slug</th>
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Diperbarui</th>
                    <th className="px-4 py-3.5 text-right text-sm font-medium text-foreground">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-medium text-foreground">{p.title}</td>
                      <td className="px-4 py-3.5 font-mono text-sm text-[var(--muted)]">{p.slug}</td>
                      <td className="px-4 py-3.5 text-sm text-[var(--muted)]">{formatDate(p.updated_at)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-2">
                          <Link
                            href={`/panel/landing-pages/${p.id}/edit`}
                            className="text-sm font-medium text-[var(--primary)] hover:underline"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/lp/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[var(--primary)] hover:underline"
                          >
                            Lihat
                          </Link>
                          <DeleteButton id={p.id} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
