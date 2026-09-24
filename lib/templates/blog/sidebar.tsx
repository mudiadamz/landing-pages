import Link from "next/link";
import type { BlogArchiveMonth, BlogLabel } from "@/lib/actions/blog";
import { archivePath, labelPath } from "@/lib/blog-path";
import { type Locale, t } from "@/lib/i18n";

/**
 * The two widgets every Blogger theme had, because they are the two ways people
 * actually navigate an archive: by subject and by date.
 *
 * Rendered from data passed in, never fetched here — presentation does not
 * fetch (docs/architecture.md §2).
 */

const MONTH_NAMES: Record<Locale, string[]> = {
  id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

export function monthName(month: string, locale: Locale): string {
  return MONTH_NAMES[locale][Number(month) - 1] ?? month;
}

export function BlogSidebar({
  labels,
  months,
  locale,
}: {
  labels: BlogLabel[];
  months: BlogArchiveMonth[];
  locale: Locale;
}) {
  // A label cloud of 65 entries is a wall. The long tail stays reachable
  // through the posts that carry it; the sidebar shows what the blog is mostly
  // about.
  const topLabels = labels.slice(0, 24);

  // Grouped by year and collapsed: 8 years of months is 96 links, which is a
  // page of its own, not a sidebar. The current year opens by default.
  const byYear = new Map<string, BlogArchiveMonth[]>();
  for (const m of months) byYear.set(m.year, [...(byYear.get(m.year) ?? []), m]);
  const years = [...byYear.keys()];

  if (topLabels.length === 0 && years.length === 0) return null;

  return (
    <aside className="space-y-8 text-sm">
      {topLabels.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {t("blog.labels", undefined, locale)}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {topLabels.map((l) => (
              <Link
                key={l.slug}
                href={labelPath(l.name)}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                {l.name} <span className="opacity-60">{l.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {years.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {t("blog.archive", undefined, locale)}
          </h2>
          <div className="space-y-1">
            {years.map((year, i) => (
              <details key={year} open={i === 0} className="group">
                <summary className="cursor-pointer list-none py-1 text-foreground transition-colors hover:text-[var(--primary)]">
                  <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
                  {year}
                </summary>
                <ul className="ml-4 space-y-0.5 border-l border-[var(--border)] pl-3">
                  {(byYear.get(year) ?? []).map((m) => (
                    <li key={`${m.year}-${m.month}`}>
                      <Link
                        href={archivePath(m.year, m.month)}
                        className="text-[var(--muted)] transition-colors hover:text-[var(--primary)]"
                      >
                        {monthName(m.month, locale)}{" "}
                        <span className="text-xs opacity-60">({m.count})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
