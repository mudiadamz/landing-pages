import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLandingPageBySlug, getLandingPageForCheckout } from "@/lib/actions/landing-pages";
import { buildMetaDescription } from "@/lib/seo";
import { guardPreviewHtml } from "@/lib/preview-guard";
import { PreviewBar } from "../preview-bar";
import { PreviewBuyBar } from "../preview-buy-bar";
import { PreviewSurface } from "../preview-surface";
import { PreviewGuardClient } from "../preview-guard-client";
import { PdfPreview } from "@/components/pdf-preview";

const getPageBySlug = cache((slug: string) => getLandingPageBySlug(slug));
const getCheckoutData = cache((slug: string) => getLandingPageForCheckout(slug));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [page, checkoutData] = await Promise.all([
    getPageBySlug(slug),
    getCheckoutData(slug),
  ]);
  if (!page) return { title: "Not found" };
  const description = buildMetaDescription(
    checkoutData?.long_description,
    `Preview ${page.title} — template landing page siap pakai. Lihat demo langsung sebelum beli.`,
  );
  const url = `/lp/${slug}`;
  const images = checkoutData?.thumbnail_url ? [checkoutData.thumbnail_url] : undefined;
  return {
    title: page.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: page.title, description, url, images, type: "website" },
    twitter: { card: "summary_large_image", title: page.title, description, images },
  };
}

export default async function LandingPageView({ params }: Props) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  // Preview source: an uploaded PDF or external link is embedded directly;
  // otherwise the inline HTML is rendered (with anti-copy guards).
  const previewUrl = page.preview_url?.trim() || null;
  const embedPdf = page.preview_type === "pdf" && !!previewUrl;
  const embedLink = page.preview_type === "link" && !!previewUrl;

  // Pricing for the sticky buy CTA (mirrors the checkout page's display logic).
  const checkout = await getCheckoutData(slug);
  const isFree = checkout?.is_free === true;
  const priceDiscount = checkout?.price_discount ?? 0;
  const basePrice = checkout?.price ?? 0;
  const displayPrice = !isFree && priceDiscount > 0 ? priceDiscount : basePrice;
  const showAsFree = isFree || displayPrice <= 0;
  const buyLabel = showAsFree ? "Ambil gratis" : "Beli sekarang";
  const priceText = showAsFree ? null : `Rp ${displayPrice.toLocaleString("id-ID")}`;
  // External-link previews are cross-origin, so scroll can't be observed —
  // fall back to revealing the CTA after a short delay.
  const autoRevealMs = embedLink ? 5000 : undefined;

  return (
    <>
      <PreviewGuardClient />
      <PreviewSurface mode={embedPdf ? "pdf" : embedLink ? "link" : "html"}>
        {embedPdf ? (
          // Render with pdf.js (react-pdf), lazily page-by-page, so a heavy PDF
          // streams in as the user scrolls instead of loading all at once.
          <PdfPreview url={previewUrl as string} title={page.title} />
        ) : embedLink ? (
          <iframe
            src={previewUrl ?? undefined}
            title={page.title}
            className="w-full h-full min-h-full border-0 block"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
          />
        ) : (
          <iframe
            srcDoc={guardPreviewHtml(page.html_content)}
            title={page.title}
            className="w-full h-full min-h-full border-0 block"
            sandbox="allow-scripts allow-same-origin allow-modals"
          />
        )}
      </PreviewSurface>
      <PreviewBar slug={slug} />
      <PreviewBuyBar
        slug={slug}
        label={buyLabel}
        priceText={priceText}
        autoRevealMs={autoRevealMs}
      />
    </>
  );
}
