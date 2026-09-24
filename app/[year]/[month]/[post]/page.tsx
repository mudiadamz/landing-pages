import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentSite } from "@/lib/site-resolve";
import { requestLocale } from "@/lib/i18n/request";
import { getBlogComments, getBlogLabels, getBlogArchiveMonths, getBlogPostByPath } from "@/lib/actions/blog";
import { postPathFromSegments } from "@/lib/blog-path";
import { BlogHeader, BlogFooter } from "@/lib/templates/blog/chrome";
import { BlogPostView } from "@/lib/templates/blog/post-view";
import { BlogSidebar } from "@/lib/templates/blog/sidebar";
import { siteBrand } from "@/lib/site-brand";
import { createClient } from "@/lib/db/server";

/**
 * A post, at the address Blogger gave it: /2026/09/judul.html
 *
 * Three dynamic segments and no catch-all, deliberately. A catch-all here would
 * sit under every unmatched path on every storefront in the deployment; three
 * segments plus the year/month validation in `postPathFromSegments` means this
 * route only ever answers for something shaped like a Blogger post URL, and
 * static segments (`/panel`, `/checkout`, `/api`) still win at every level.
 */

type Props = { params: Promise<{ year: string; month: string; post: string }> };

async function resolve(params: Props["params"]) {
  const { year, month, post } = await params;
  const path = postPathFromSegments(year, month, post);
  if (!path) return null;
  return getBlogPostByPath(path);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await resolve(params);
  if (!post) return {};
  const description = post.metaDescription?.trim() || post.excerpt;
  return {
    title: post.title,
    description,
    alternates: { canonical: post.path },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url: post.path,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: post.thumbnailUrl ? [post.thumbnailUrl] : undefined,
    },
  };
}

export default async function BlogPostRoute({ params }: Props) {
  const post = await resolve(params);
  if (!post) notFound();

  const db = await createClient();
  const [site, locale, comments, labels, months, { data: { user } }] = await Promise.all([
    currentSite(),
    requestLocale(),
    getBlogComments(post.id),
    getBlogLabels(),
    getBlogArchiveMonths(),
    db.auth.getUser(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <BlogHeader user={user} brand={siteBrand(site)} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <BlogPostView post={post} comments={comments} locale={locale} />
          <BlogSidebar labels={labels} months={months} locale={locale} />
        </div>
      </main>
      <BlogFooter />
    </div>
  );
}
