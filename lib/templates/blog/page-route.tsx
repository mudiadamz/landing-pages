import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { currentSite } from "@/lib/site-resolve";
import { requestLocale } from "@/lib/i18n/request";
import { siteBrand } from "@/lib/site-brand";
import { getBlogComments, getBlogPostByPath } from "@/lib/actions/blog";
import { BlogHeader, BlogFooter } from "./chrome";
import { BlogPostView } from "./post-view";

/**
 * An imported Blogger page at /p/slug.html, in the blog chrome.
 *
 * Lives here rather than in app/p/[slug]/page.tsx so that route stays what it
 * has always been — the editorial-page route — with one fallback branch at the
 * end instead of two page implementations interleaved.
 *
 * No sidebar: a standalone page (About, a privacy policy) is not part of the
 * archive and gains nothing from a label cloud beside it.
 */
export async function BlogPageRoute({ path }: { path: string }) {
  const post = await getBlogPostByPath(path);
  if (!post) notFound();

  const db = await createClient();
  const [site, locale, comments, { data: { user } }] = await Promise.all([
    currentSite(),
    requestLocale(),
    getBlogComments(post.id),
    db.auth.getUser(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <BlogHeader user={user} brand={siteBrand(site)} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <BlogPostView post={post} comments={comments} locale={locale} />
      </main>
      <BlogFooter />
    </div>
  );
}
