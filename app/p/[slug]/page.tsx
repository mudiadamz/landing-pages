import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { currentSite } from "@/lib/site-resolve";
import { getPublishedPage } from "@/lib/actions/pages";
import { getBlogPostByPath } from "@/lib/actions/blog";
import { buildPagePath, stripHtmlSuffix } from "@/lib/blog-path";
import { TemplateHeader, TemplateFooter } from "@/lib/templates/chrome";
import { BlogPageRoute } from "@/lib/templates/blog/page-route";

/**
 * An editorial page, in the storefront's own chrome.
 *
 * Draft pages 404 rather than 403: an unpublished URL should be indistinguishable
 * from one that was never created, or the panel leaks what is being written.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) {
    // A Blogger page lives at /p/slug.html; this app's own editorial pages have
    // no suffix. The `.html` is the whole of what separates them, which is why
    // stripHtmlSuffix returns null rather than the slug when it is absent.
    const blogSlug = stripHtmlSuffix(slug);
    const post = blogSlug ? await getBlogPostByPath(buildPagePath(blogSlug)) : null;
    if (post) {
      return {
        title: post.title,
        description: post.metaDescription?.trim() || post.excerpt,
        alternates: { canonical: post.path },
      };
    }
  }
  // notFound() here as well as in the component: metadata resolves first, so
  // this is the earliest point a missing page is known.
  //
  // It does NOT currently produce a 404 status. Every dynamic route in this app
  // answers a missing record with the 404 BODY under a 200 — /checkout/<missing>
  // and /preview/<missing> do the same, and only genuinely unmatched paths get a
  // real 404. So this is the app's existing behaviour, not this route's, and it
  // is worth fixing once for all of them rather than papered over here.
  if (!page) notFound();
  const text = page.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return {
    title: page.title,
    description: text.slice(0, 155) || page.title,
  };
}

export default async function EditorialPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await createClient();
  const site = await currentSite();
  const [{ data: { user } }, categories, page] = await Promise.all([
    db.auth.getUser(),
    getCategories(site.business_id),
    getPublishedPage(slug),
  ]);

  // Editorial page first, imported Blogger page second. That order is the
  // compatibility rule: a page written in this panel owns its slug, and an
  // import can never take an address out from under it.
  if (!page) {
    const blogSlug = stripHtmlSuffix(slug);
    if (blogSlug) return <BlogPageRoute path={buildPagePath(blogSlug)} />;
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TemplateHeader user={user} categories={categories} />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {page.title}
          </h1>
          {/* Sanitised on write (lib/page-html), so what is stored is already
              what is safe to render — see the note there about why that is the
              side to do it on. */}
          <div
            className="page-prose mt-6"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </section>
      </main>
      <TemplateFooter />
    </div>
  );
}
