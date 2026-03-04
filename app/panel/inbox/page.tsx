import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { getReceivedEmailsForAdmin, getReceivedEmailById } from "@/lib/actions/received-emails";

type Props = { searchParams: Promise<{ id?: string }> };

export default async function InboxPage({ searchParams }: Props) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");

  const { id: detailId } = await searchParams;
  const [emails, detail] = await Promise.all([
    getReceivedEmailsForAdmin(),
    detailId ? getReceivedEmailById(detailId) : Promise.resolve(null),
  ]);

  function formatDate(s: string) {
    return new Date(s).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function fromDisplay(email: { from_name: string | null; from_address: string }) {
    if (email.from_name) return `${email.from_name} <${email.from_address}>`;
    return email.from_address;
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
        <h1 className="text-xl font-semibold tracking-tight">Email masuk (admin@admuiux.com)</h1>
      </div>

      {emails.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
          <p className="text-sm text-[var(--muted)]">Belum ada email masuk.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Email yang dikirim ke admin@admuiux.com akan muncul di sini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm max-h-[70vh] flex flex-col">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--background)]/50">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Daftar</p>
            </div>
            <ul className="overflow-y-auto flex-1 divide-y divide-[var(--border)]">
              {emails.map((e) => {
                const isActive = detail?.id === e.id;
                return (
                  <li key={e.id}>
                    <Link
                      href={isActive ? "/panel/inbox" : `/panel/inbox?id=${e.id}`}
                      className={`block px-4 py-3 hover:bg-[var(--background)]/50 transition-colors ${isActive ? "bg-[var(--accent-subtle)]" : ""}`}
                    >
                      <p className="font-medium text-foreground truncate">{e.subject || "(Tanpa subjek)"}</p>
                      <p className="text-sm text-[var(--muted)] truncate">{fromDisplay(e)}</p>
                      <p className="text-xs text-[var(--muted)] mt-0.5">{formatDate(e.received_at)}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="lg:col-span-2">
            {detail ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
                <div className="p-4 border-b border-[var(--border)] bg-[var(--background)]/50 space-y-1">
                  <p className="text-sm font-medium text-foreground">{detail.subject || "(Tanpa subjek)"}</p>
                  <p className="text-sm text-[var(--muted)]">Dari: {fromDisplay(detail)}</p>
                  <p className="text-xs text-[var(--muted)]">Kepada: {detail.to_addresses?.join(", ") || "—"}</p>
                  <p className="text-xs text-[var(--muted)]">{formatDate(detail.received_at)}</p>
                </div>
                <div className="p-4 min-h-[200px]">
                  {detail.body_html ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                      dangerouslySetInnerHTML={{ __html: detail.body_html }}
                    />
                  ) : detail.body_text ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">{detail.body_text}</pre>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">Tidak ada isi.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
                <p className="text-sm text-[var(--muted)]">Pilih email di daftar untuk melihat isi.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
