"use client";

import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/client";

/**
 * The search box, as a plain GET form to `/search`.
 *
 * Not a fetch-as-you-type control: `/search?q=…` is a Blogger address that
 * people have bookmarked and linked, so the result has to be a real page at a
 * real URL. A form that submits gives that for free, works with JavaScript off,
 * and lets the back button behave.
 *
 * A client component only to prefill from the current query — everything else
 * here is HTML doing its job.
 */
export function BlogSearchBox() {
  const t = useT();
  const params = useSearchParams();
  return (
    <form action="/search" method="get" role="search" className="relative">
      <input
        type="search"
        name="q"
        defaultValue={params.get("q") ?? ""}
        placeholder={t("blog.searchPlaceholder")}
        aria-label={t("blog.searchPlaceholder")}
        className="w-full rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
      />
    </form>
  );
}
