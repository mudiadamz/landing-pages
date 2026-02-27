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
      <h1 className="text-xl font-semibold">Landing pages</h1>

      <div className="overflow-x-auto">
        <table className="w-full border border-foreground/10 rounded-md overflow-hidden">
          <thead>
            <tr className="bg-foreground/5 text-left">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-foreground/60">
                  No landing pages yet. Upload an HTML file or create a new page.
                </td>
              </tr>
            ) : (
              pages.map((p) => (
                <tr key={p.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3">{p.title}</td>
                  <td className="px-4 py-3 font-mono text-sm">{p.slug}</td>
                  <td className="px-4 py-3 text-foreground/80 text-sm">
                    {formatDate(p.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex gap-2">
                      <Link
                        href={`/panel/landing-pages/${p.id}/edit`}
                        className="text-sm text-foreground/80 hover:underline"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/lp/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-foreground/80 hover:underline"
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
  );
}
