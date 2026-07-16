import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { canSellProducts } from "@/lib/actions/profiles";
import { getLandingPageById, getCategories } from "@/lib/actions/landing-pages";
import { ProductEditForm } from "./product-edit-form";
import { Button } from "@/components/ui/button";
import type { PreviewType } from "@/lib/actions/landing-pages";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const canSell = await canSellProducts();
  if (!canSell) redirect("/panel");

  const { id } = await params;
  const [page, categories] = await Promise.all([getLandingPageById(id), getCategories()]);
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/panel"
            className="text-sm text-[var(--muted)] transition-colors hover:text-foreground"
          >
            ← Kembali
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Edit produk digital</h1>
          <span className="w-fit rounded bg-[var(--background)] px-2 py-1 font-mono text-sm text-[var(--muted)]">
            {page.slug}
          </span>
        </div>
        <Button
          href={`/lp/${page.slug}`}
          external
          variant="secondary"
          size="sm"
          leftIcon={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
          className="shrink-0"
        >
          Preview landing page
        </Button>
      </div>

      <ProductEditForm
        pageId={id}
        slug={page.slug}
        initialHtml={page.html_content}
        categories={categories}
        initial={{
          title: page.title,
          preview_type: (page as { preview_type?: PreviewType }).preview_type ?? "html",
          preview_url: (page as { preview_url?: string | null }).preview_url ?? null,
          price: page.price,
          price_discount: page.price_discount,
          is_free: page.is_free,
          featured: page.featured,
          thumbnail_url: page.thumbnail_url,
          zip_url: (page as { zip_url?: string | null }).zip_url ?? null,
          story_pdf_url: (page as { story_pdf_url?: string | null }).story_pdf_url ?? null,
          category_id: (page as { category_id?: string | null }).category_id ?? null,
          long_description: (page as { long_description?: string | null }).long_description ?? null,
        }}
      />
    </div>
  );
}
