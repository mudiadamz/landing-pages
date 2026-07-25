import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { canSellProducts } from "@/lib/actions/profiles";
import { getLandingPageById, getCategories, getLandingPagesForUser } from "@/lib/actions/landing-pages";
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
  const [page, categories, myProducts] = await Promise.all([
    getLandingPageById(id),
    getCategories(),
    getLandingPagesForUser(),
  ]);
  if (!page) notFound();

  // Candidate products to mark as "related" — the seller's own products, minus
  // this one. Keeps the picker to what they can vouch for.
  const relatedOptions = myProducts
    .filter((p) => p.id !== id)
    .map((p) => ({ id: p.id, title: p.title, slug: p.slug }));

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
        <div className="flex shrink-0 items-center gap-2">
          <Button
            href={`/panel/product/${id}/stats`}
            variant="secondary"
            size="sm"
            leftIcon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6m4 6V5m4 14v-9M5 19h14" />
              </svg>
            }
          >
            Statistik
          </Button>
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
          >
            Preview
          </Button>
        </div>
      </div>

      <ProductEditForm
        pageId={id}
        slug={page.slug}
        initialHtml={page.html_content}
        categories={categories}
        relatedOptions={relatedOptions}
        initial={{
          title: page.title,
          preview_type: (page as { preview_type?: PreviewType }).preview_type ?? "html",
          preview_url: (page as { preview_url?: string | null }).preview_url ?? null,
          preview_url_dark: (page as { preview_url_dark?: string | null }).preview_url_dark ?? null,
          price: page.price,
          price_discount: page.price_discount,
          is_free: page.is_free,
          featured: page.featured,
          thumbnail_url: page.thumbnail_url,
          zip_url: (page as { zip_url?: string | null }).zip_url ?? null,
          story_pdf_url: (page as { story_pdf_url?: string | null }).story_pdf_url ?? null,
          story_pdf_url_dark: (page as { story_pdf_url_dark?: string | null }).story_pdf_url_dark ?? null,
          story_epub_url: (page as { story_epub_url?: string | null }).story_epub_url ?? null,
          category_id: (page as { category_id?: string | null }).category_id ?? null,
          long_description: (page as { long_description?: string | null }).long_description ?? null,
          preview_label: (page as { preview_label?: "product" | "buku" | "pages" | null }).preview_label ?? null,
          cta_label: (page as { cta_label?: string | null }).cta_label ?? null,
          cta_note: (page as { cta_note?: string | null }).cta_note ?? null,
          purchase_link: (page as { purchase_link?: string | null }).purchase_link ?? null,
          purchase_type: (page as { purchase_type?: "external" | "internal" }).purchase_type,
          cta_reveal: (page as { cta_reveal?: "start" | "middle" | "near" | "end" | null }).cta_reveal ?? null,
          cta_action: (page as { cta_action?: "checkout" | "link" | "calendar" | null }).cta_action ?? null,
          event_title: (page as { event_title?: string | null }).event_title ?? null,
          event_start: (page as { event_start?: string | null }).event_start ?? null,
          event_end: (page as { event_end?: string | null }).event_end ?? null,
          event_location: (page as { event_location?: string | null }).event_location ?? null,
          event_description: (page as { event_description?: string | null }).event_description ?? null,
          related_product_ids: (page as { related_product_ids?: string[] | null }).related_product_ids ?? null,
          next_product_id: (page as { next_product_id?: string | null }).next_product_id ?? null,
          available_at: (page as { available_at?: string | null }).available_at ?? null,
        }}
      />
    </div>
  );
}
