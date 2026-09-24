import Link from "next/link";
import type { BlogPostSummary } from "@/lib/actions/blog";
import { labelPath } from "@/lib/blog-path";
import { type Locale, t } from "@/lib/i18n";

/**
 * One entry in a list of posts — the feed, a label, an archive month, a search.
 *
 * Every list renders through this so the four surfaces cannot drift into four
 * slightly different cards. It is a plain server component: a card has nothing
 * to be interactive about, and the paths it links to are already strings.
 */

export function formatPostDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PostCard({ post, locale }: { post: BlogPostSummary; locale: Locale }) {
  return (
    <article className="border-b border-[var(--border)] pb-7 last:border-0">
      <h2 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
        <Link href={post.path} className="text-foreground transition-colors hover:text-[var(--primary)]">
          {post.title}
        </Link>
      </h2>

      <p className="mt-1.5 text-xs text-[var(--muted)]">
        <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
        {post.wordCount > 0 && (
          <>
            {" · "}
            {t("blog.readingTime", { minutes: Math.max(1, Math.round(post.wordCount / 200)) }, locale)}
          </>
        )}
      </p>

      {post.excerpt && (
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--muted)]">{post.excerpt}</p>
      )}

      {post.labels.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-1.5">
          {post.labels.map((label) => (
            <Link
              key={label}
              href={labelPath(label)}
              className="rounded-full bg-[var(--background)] px-2.5 py-0.5 text-xs text-[var(--muted)] transition-colors hover:text-[var(--primary)]"
            >
              {label}
            </Link>
          ))}
        </p>
      )}
    </article>
  );
}

/**
 * The pager, as plain links.
 *
 * Blogger's own "Older posts" is a link and not a button, which is what lets a
 * crawler walk the whole archive. Keeping it a link is the difference between a
 * blog that can be indexed and one that ends at post ten.
 */
export function PostPager({
  page,
  pageCount,
  hrefFor,
  locale,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  locale: Locale;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-6 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="text-[var(--primary)] hover:underline">
          ← {t("blog.newerPosts", undefined, locale)}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-[var(--muted)]">
        {t("blog.pageOf", { page, total: pageCount }, locale)}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className="text-[var(--primary)] hover:underline">
          {t("blog.olderPosts", undefined, locale)} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
