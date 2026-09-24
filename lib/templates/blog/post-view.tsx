import Link from "next/link";
import type { BlogComment, BlogPost } from "@/lib/actions/blog";
import { archiveOfPath, labelPath, archivePath } from "@/lib/blog-path";
import { sanitizePageHtml } from "@/lib/page-html";
import { type Locale, t } from "@/lib/i18n";
import { formatPostDate } from "./post-card";
import { monthName } from "./sidebar";

/**
 * One post, rendered as an article.
 *
 * The body is sanitised HERE rather than on import. Two reasons, and the second
 * is the one that matters: the importer keeps the source exactly as Blogger had
 * it (so a re-import is not a slow lossy rewrite of your own archive), and a
 * later improvement to the sanitiser applies to every post already stored
 * instead of only to the ones imported after it.
 *
 * 36 of the imported posts carry `<script>` — AdSense and analytics pasted in
 * years ago. `sanitizePageHtml` strips exactly those and leaves the 281 posts
 * with tables intact, which is the right trade for an archive. It also strips
 * `<iframe>`, which costs this archive one YouTube embed.
 */
export function BlogPostView({
  post,
  comments,
  locale,
}: {
  post: BlogPost;
  comments: BlogComment[];
  locale: Locale;
}) {
  const archive = archiveOfPath(post.path);
  const html = sanitizePageHtml(post.content);

  // Threading, one level deep. Blogger allowed exactly one level of reply and
  // the export carries `parent_comment_id` to match; rendering an arbitrary
  // tree would invent a structure the data does not have.
  const roots = comments.filter((c) => !c.parentId);
  const repliesOf = new Map<string, BlogComment[]>();
  for (const c of comments) {
    if (!c.parentId) continue;
    repliesOf.set(c.parentId, [...(repliesOf.get(c.parentId) ?? []), c]);
  }

  return (
    <article className="min-w-0">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
          {post.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
          {post.authorName && <> · {post.authorName}</>}
          {archive && (
            <>
              {" · "}
              <Link href={archivePath(archive.year, archive.month)} className="hover:text-[var(--primary)]">
                {monthName(archive.month, locale)} {archive.year}
              </Link>
            </>
          )}
        </p>
      </header>

      {/* `.page-prose` is the same typographic scale the editorial pages use, so
          an imported post and a page written here read as one publication. */}
      <div className="page-prose" dangerouslySetInnerHTML={{ __html: html }} />

      {post.labels.length > 0 && (
        <footer className="mt-8 flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-5">
          {post.labels.map((label) => (
            <Link
              key={label}
              href={labelPath(label)}
              className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              {label}
            </Link>
          ))}
        </footer>
      )}

      {roots.length > 0 && (
        <section className="mt-10 border-t border-[var(--border)] pt-7">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            {t("blog.comments", { count: comments.length }, locale)}
          </h2>
          <ul className="space-y-5">
            {roots.map((c) => (
              <li key={c.id}>
                <CommentBody comment={c} locale={locale} />
                {(repliesOf.get(c.id) ?? []).length > 0 && (
                  <ul className="mt-4 space-y-4 border-l-2 border-[var(--border)] pl-4">
                    {(repliesOf.get(c.id) ?? []).map((r) => (
                      <li key={r.id}>
                        <CommentBody comment={r} locale={locale} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {/* No form. Comments are imported and read-only (2026-09-24) — saying
              so beats a comment section that silently accepts nothing. */}
          <p className="mt-6 text-xs text-[var(--muted)]">{t("blog.commentsClosed", undefined, locale)}</p>
        </section>
      )}
    </article>
  );
}

function CommentBody({ comment, locale }: { comment: BlogComment; locale: Locale }) {
  const name = comment.authorName?.trim() || t("blog.anonymous", undefined, locale);
  return (
    <div>
      <p className="text-sm font-medium text-foreground">
        {comment.authorUrl ? (
          <a
            href={comment.authorUrl}
            rel="nofollow ugc noopener noreferrer"
            target="_blank"
            className="hover:text-[var(--primary)]"
          >
            {name}
          </a>
        ) : (
          name
        )}
        <span className="ml-2 text-xs font-normal text-[var(--muted)]">
          {formatPostDate(comment.publishedAt, locale)}
        </span>
      </p>
      {/* Comment bodies are other people's HTML from a decade of Blogger. Same
          sanitiser as the post: anything that executes goes, the rest stays. */}
      <div
        className="mt-1 text-sm leading-relaxed text-[var(--muted)] [&_a]:text-[var(--primary)] [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: sanitizePageHtml(comment.content) }}
      />
    </div>
  );
}
