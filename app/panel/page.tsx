import Link from "next/link";
import { getLandingPagesForUser } from "@/lib/actions/landing-pages";
import { DeleteButton } from "./delete-button";

export default async function PanelPage() {
  const pages = await getLandingPagesForUser();

  function formatDate(s: string) {
    return new Date(s).toLocaleDateString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Landing pages</h1>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">
                  Title
                </th>
                <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">
                  Slug
                </th>
                <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">
                  Updated
                </th>
                <th className="px-4 py-3.5 text-right text-sm font-medium text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pages.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-sm text-[var(--muted)]"
                  >
                    No landing pages yet. Upload an HTML file or create a new page.
                  </td>
                </tr>
              ) : (
                pages.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-medium text-foreground">
                      {p.title}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-sm text-[var(--muted)]">
                      {p.slug}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[var(--muted)]">
                      {formatDate(p.updated_at)}
                    </td>
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
                          View
                        </Link>
                        <DeleteButton id={p.id} />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
