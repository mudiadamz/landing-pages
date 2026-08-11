import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { getPublishedPage } from "@/lib/actions/pages";
import { TemplateHeader, TemplateFooter } from "@/lib/templates/chrome";

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
  if (!page) return { title: "Halaman" };
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
  const supabase = await createClient();
  const [{ data: { user } }, categories, page] = await Promise.all([
    supabase.auth.getUser(),
    getCategories(),
    getPublishedPage(slug),
  ]);
  if (!page) notFound();

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
