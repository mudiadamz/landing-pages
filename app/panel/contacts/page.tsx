import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { getContactsForAdmin } from "@/lib/actions/contacts";

export default async function ContactsPage() {
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");

  const contacts = await getContactsForAdmin();

  function formatDate(s: string) {
    return new Date(s).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Link
          href="/panel"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Pesan kontak</h1>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
          <p className="text-sm text-[var(--muted)]">Belum ada pesan kontak.</p>
        </div>
      ) : (
        <>
          <div className="sm:hidden space-y-3">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <p className="font-medium text-foreground">{c.name}</p>
                <a href={`mailto:${c.email}`} className="text-sm text-[var(--primary)] hover:underline">
                  {c.email}
                </a>
                <p className="mt-2 text-sm text-[var(--muted)] whitespace-pre-wrap">{c.message}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">{formatDate(c.created_at)}</p>
              </div>
            ))}
          </div>
          <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Nama</th>
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Email</th>
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Pesan</th>
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-medium text-foreground">{c.name}</td>
                      <td className="px-4 py-3.5 text-sm">
                        <a href={`mailto:${c.email}`} className="text-[var(--primary)] hover:underline">
                          {c.email}
                        </a>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[var(--muted)] max-w-xs whitespace-pre-wrap truncate">
                        {c.message}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[var(--muted)]">{formatDate(c.created_at)}</td>
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
