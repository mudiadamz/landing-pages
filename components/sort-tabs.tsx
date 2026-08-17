import Link from "next/link";
import { translator, type MessageKey } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import type { HomepageSort } from "@/lib/actions/landing-pages";

type Props = {
  /** Path the tabs link to, e.g. "/" or "/category/foo". */
  basePath: string;
  current: HomepageSort;
};

const TABS: { key: HomepageSort; labelKey: MessageKey }[] = [
  { key: "newest", labelKey: "panel.sortRecent" },
  { key: "popular", labelKey: "home.bestSelling" },
];

export async function SortTabs({ basePath, current }: Props) {
  const t = translator(await requestLocale());
  return (
    <div className="mb-4 sm:mb-6 flex items-center gap-1.5">
      <span className="sr-only">{t("home.sortProducts")}</span>
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
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
