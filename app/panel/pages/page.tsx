import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { listPages } from "@/lib/actions/pages";
import { PanelPageHeader } from "@/components/panel-page-header";
import { NewPageButton } from "./new-page-button";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

/**
 * Editorial pages for this storefront.
 *
 * Separate from Konten situs, which edits the fixed surfaces the code already
 * renders — a footer tagline has one place it can go. These are pages a person
 * invents: they get a URL, a title, and no code knows their names.
 */
export default async function PagesIndex() {
  const t = translator(await requestLocale());
  if (!(await requireAdmin())) redirect("/panel");
  const pages = await listPages();

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title="Halaman" actions={<NewPageButton />} />

      <p className="text-sm text-[var(--muted)]">
        {t("panel.pagesIntro")}
      </p>

      {pages.length === 0 ? (
        <p className="rounded-2xl bg-[var(--accent-subtle)] px-6 py-12 text-center text-sm text-[var(--muted)]">
          {t("panel.noPages")}
        </p>
      ) : (
        <ul className="space-y-2">
          {pages.map((p) => (
            <li key={p.id}>
              <Link
                href={`/panel/pages/${p.id}`}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition-colors hover:bg-[var(--background)]/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {p.title}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-xs text-[var(--muted)]">
                    /p/{p.slug}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${
                    p.published
                      ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                      : "bg-[var(--accent-subtle)] text-[var(--muted)]"
                  }`}
                >
                  {p.published ? t("panel.published") : t("panel.draft")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
