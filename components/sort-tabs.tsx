import Link from "next/link";
import type { HomepageSort } from "@/lib/actions/landing-pages";

type Props = {
  /** Path the tabs link to, e.g. "/" or "/category/foo". */
  basePath: string;
  current: HomepageSort;
};

const TABS: { key: HomepageSort; label: string }[] = [
  { key: "newest", label: "Terbaru" },
  { key: "popular", label: "Terlaris" },
];

export function SortTabs({ basePath, current }: Props) {
  return (
    <div className="mb-4 sm:mb-6 flex items-center gap-1.5">
      <span className="sr-only">Urutkan produk</span>
      {TABS.map((tab) => {
        const active = tab.key === current;
        // "newest" is the default — omit the query for a clean URL.
        const href =
          tab.key === "newest"
            ? `${basePath}#templates`
            : `${basePath}?sort=${tab.key}#templates`;
        return (
          <Link
            key={tab.key}
            href={href}
            aria-current={active ? "true" : undefined}
            className={
              active
                ? "px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] transition-colors"
                : "px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--muted)] hover:text-foreground hover:bg-[var(--card)] transition-colors"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
