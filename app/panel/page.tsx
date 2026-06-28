import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/actions/profiles";
import { getLandingPagesForUser } from "@/lib/actions/landing-pages";
import { getPurchasesForUser, getInvoicesForUser } from "@/lib/actions/purchases";
import { getReviewsByUser } from "@/lib/actions/reviews";
import { DeleteButton } from "./delete-button";
import { PinButton } from "./pin-button";

const ACTION_LINK =
  "inline-flex items-center justify-center p-2 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--background)] transition-colors";

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

const CustomerTabs = dynamic(() =>
  import("./customer-tabs").then((m) => m.CustomerTabs),
);

export default async function PanelPage() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    return <CustomerPanel />;
  }

  return <AdminPanel />;
}

async function CustomerPanel() {
  const [purchases, invoices, reviews] = await Promise.all([
    getPurchasesForUser(),
    getInvoicesForUser(),
    getReviewsByUser(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Pembelian saya</h1>
      <CustomerTabs purchases={purchases} invoices={invoices} reviews={reviews} />
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Produk digital</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="md"
            href="/panel/upload"
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            }
            className="gap-2"
          >
            Upload
          </Button>
          <Button
            size="md"
            href="/panel/landing-pages/new"
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
            className="gap-2 hover:opacity-90"
          >
            Buat baru
          </Button>
        </div>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
          <p className="text-sm text-[var(--muted)]">Belum ada produk digital.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              variant="secondary"
              size="md"
              href="/panel/upload"
              className="gap-2"
            >
              Upload HTML
            </Button>
            <Button
              size="md"
              href="/panel/landing-pages/new"
              className="gap-2 hover:opacity-90"
            >
              Buat halaman baru
            </Button>
          </div>
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
                <div className="mt-3 flex items-center gap-1">
                  <PinButton id={p.id} featured={!!p.featured} />
                  <Link href={`/panel/landing-pages/${p.id}/edit`} className={ACTION_LINK} title="Edit" aria-label="Edit">
                    <EditIcon />
                  </Link>
                  <Link href={`/lp/${p.slug}`} target="_blank" rel="noopener noreferrer" className={ACTION_LINK} title="Lihat" aria-label="Lihat">
                    <ViewIcon />
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
                        <span className="inline-flex items-center justify-end gap-1">
                          <PinButton id={p.id} featured={!!p.featured} />
                          <Link href={`/panel/landing-pages/${p.id}/edit`} className={ACTION_LINK} title="Edit" aria-label="Edit">
                            <EditIcon />
                          </Link>
                          <Link href={`/lp/${p.slug}`} target="_blank" rel="noopener noreferrer" className={ACTION_LINK} title="Lihat" aria-label="Lihat">
                            <ViewIcon />
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
