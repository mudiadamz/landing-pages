import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";
import { EpubReader } from "@/components/epub-reader";
import { EpubBootSplash } from "@/components/epub-boot-splash";
import { PdfPreview } from "@/components/pdf-preview";
import { PreviewSurface } from "../../preview/preview-surface";
import { ProductActionsMenu } from "@/components/product-actions";
import { currentSite } from "@/lib/site-resolve";
import { ImmersiveController } from "@/components/immersive-controller";
import { epubVersionToken } from "@/lib/epub-version";

/**
 * Reader for a product the visitor already owns, opened from "Pembelian saya".
 *
 * Deliberately the same reading experience as the public preview — floating back
 * button, the "⋯" menu with font/margin/alignment/theme, focus mode — minus the
 * buy CTA, which would be nonsense for something they've already paid for. It
 * reads the full deliverable rather than the preview file.
 */
export const metadata = { title: "Baca" };

type Props = { params: Promise<{ slug: string }> };

export default async function ReadPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/read/${slug}`)}`);

  const { data: page } = await supabase
    .from("lp_landing_pages")
    .select("id, title, slug, story_epub_url, story_pdf_url, story_pdf_url_dark, thumbnail_url, user_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!page) notFound();

  // The seller can read their own product; everyone else needs a purchase.
  if (page.user_id !== user.id) {
    const { data: purchase } = await supabase
      .from("lp_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("landing_page_id", page.id)
      .maybeSingle();
    if (!purchase) redirect("/panel/purchases");
  }

  const hasEpub = !!page.story_epub_url;
  const pdfLight = !hasEpub && page.story_pdf_url ? await getSignedDownloadUrl(page.story_pdf_url) : null;
  const pdfDark = pdfLight && page.story_pdf_url_dark ? await getSignedDownloadUrl(page.story_pdf_url_dark) : null;
  if (!hasEpub && !pdfLight) redirect("/panel/purchases");

  const site = await currentSite();

  const chrome = (
    <ProductActionsMenu
      variant="floating"
      locale={site.locale}
      title={page.title}
      backHref="/panel/purchases"
      slug={slug}
      page="preview"
      isLoggedIn
      userName={(user.user_metadata?.full_name as string | undefined) || user.email || null}
      pageId={page.id}
      viewCount={0}
      epub={hasEpub}
    />
  );

  if (hasEpub) {
    return (
      <>
        <ImmersiveController />
        <EpubBootSplash
          coverUrl={`/api/epub-cover/${slug}`}
          thumbnailUrl={page.thumbnail_url}
          title={page.title}
        />
        <div className="w-full">
          <EpubReader
            locale={site.locale}
            url=""
            slug={slug}
            title={page.title}
            textEndpoint={`/api/epub-text-owned/${encodeURIComponent(slug)}`}
            version={epubVersionToken(page.story_epub_url)}
            storageKey={`read-epub:${slug}`}
          />
        </div>
        {chrome}
      </>
    );
  }

  return (
    <>
      <ImmersiveController />
      <div className="lp-reader sticky top-0 w-full overflow-hidden">
        <PreviewSurface mode="pdf">
          <PdfPreview
            url={pdfLight as string}
            urlDark={pdfDark}
            title={page.title}
            storageKey={`read-pdf:${slug}`}
          />
        </PreviewSurface>
      </div>
      {chrome}
    </>
  );
}
