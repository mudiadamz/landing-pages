import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getLandingPageBySlug, getLandingPageForCheckout, getProductsByIds } from "@/lib/actions/landing-pages";
import { isUpcoming } from "@/lib/product-status";
import { ComingSoon } from "@/components/coming-soon";
import { buildMetaDescription } from "@/lib/seo";
import { guardPreviewHtml } from "@/lib/preview-guard";
import { PreviewBuyBar } from "../preview-buy-bar";
import { PreviewSurface } from "../preview-surface";
import { PreviewGuardClient } from "../preview-guard-client";
import { PdfPreview } from "@/components/pdf-preview";
import { ProductActionsMenu } from "@/components/product-actions";
import { getMyLike } from "@/lib/actions/likes";
import { ViewTracker } from "@/components/view-tracker";
import { ProductTracker } from "@/components/product-tracker";

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
  const previewUrlDark = page.preview_url_dark?.trim() || null;
  // A PDF preview needs at least one file; if only the dark one exists, use it
  // as the default so the preview still renders.
  const pdfLight = previewUrl ?? previewUrlDark;
  const embedPdf = page.preview_type === "pdf" && !!pdfLight;
  const embedLink = page.preview_type === "link" && !!previewUrl;

  // Pricing for the sticky buy CTA (mirrors the checkout page's display logic).
  const checkout = await getCheckoutData(slug);
  const isFree = checkout?.is_free === true;
  const priceDiscount = checkout?.price_discount ?? 0;
  const basePrice = checkout?.price ?? 0;
  const displayPrice = !isFree && priceDiscount > 0 ? priceDiscount : basePrice;
  const showAsFree = isFree || displayPrice <= 0;
  // Action decides where the buy CTA leads:
  //  • calendar → download an .ics event (works on iOS/Android/desktop)
  //  • external link → straight there in a new tab
  //  • otherwise → this site's checkout (the default)
  const calendarMode =
    checkout?.cta_action === "calendar" && !!checkout?.event_start?.trim();
  const externalBuyLink =
    !calendarMode && checkout?.purchase_type === "external"
      ? checkout?.purchase_link?.trim() || null
      : null;

  const defaultLabel = calendarMode
    ? "Tambahkan ke kalender"
    : showAsFree
      ? "Ambil gratis"
      : "Beli sekarang";
  const buyLabel = checkout?.cta_label?.trim() || defaultLabel;
  const priceText = showAsFree ? null : `Rp ${displayPrice.toLocaleString("id-ID")}`;
  const buyNote = checkout?.cta_note?.trim() || null;

  const buyHref = calendarMode
    ? `/api/calendar/${slug}`
    : externalBuyLink ?? `/checkout/${slug}`;

  // When the sticky CTA reveals as the visitor scrolls the preview. The keyword
  // maps to a scroll-progress fraction (0..1); the HTML guard + PdfViewer report
  // "revealed" once the visitor passes it. "start" reveals as soon as they
  // scroll at all (0) and also auto-shows shortly after load.
  const revealKey = checkout?.cta_reveal ?? "middle";
  const revealAt = { start: 0, middle: 0.4, near: 0.75, end: 0.92 }[revealKey] ?? 0.4;
  // External-link previews are cross-origin, so scroll can't be observed — map
  // the reveal point to a timed fallback instead. For scroll-observable previews
  // only "start" gets an auto-reveal (so it shows without needing a scroll).
  const autoRevealMs = embedLink
    ? { start: 1200, middle: 5000, near: 9000, end: 13000 }[revealKey] ?? 5000
    : revealKey === "start"
      ? 1200
      : undefined;

  const viewCount = checkout?.view_count ?? 0;

  // For the "Masuk dengan Google" item in the actions menu (logged-out only)
  // and the like button's current state.
  const supabase = await createClient();
  const [{ data: { user } }, liked, related] = await Promise.all([
    supabase.auth.getUser(),
    getMyLike(page.id),
    getProductsByIds(page.related_product_ids ?? []),
  ]);

  // Scheduled but not yet released: non-owners see a countdown, not the preview.
  const isOwner = !!user && page.user_id === user.id;
  if (isUpcoming(page.available_at, isOwner)) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-y-auto p-4">
        <ComingSoon title={page.title} thumbnailUrl={page.thumbnail_url} target={page.available_at!} />
      </div>
    );
  }

  return (
    <>
      <PreviewGuardClient />
      <ViewTracker slug={slug} />
      <ProductTracker slug={slug} page="preview" />
      <PreviewSurface mode={embedPdf ? "pdf" : embedLink ? "link" : "html"}>
        {embedPdf ? (
          // Render with pdf.js (react-pdf), lazily page-by-page, so a heavy PDF
          // streams in as the user scrolls instead of loading all at once.
          <PdfPreview
            url={pdfLight as string}
            urlDark={previewUrlDark}
            title={page.title}
            storageKey={`lp-pdf:${slug}`}
            revealAt={revealAt}
            related={related}
          />
        ) : embedLink ? (
          <iframe
            src={previewUrl ?? undefined}
            title={page.title}
            className="w-full h-full min-h-full border-0 block"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
          />
        ) : (
          <iframe
            srcDoc={guardPreviewHtml(page.html_content, revealAt)}
            title={page.title}
            className="w-full h-full min-h-full border-0 block"
            sandbox="allow-scripts allow-same-origin allow-modals"
          />
        )}
      </PreviewSurface>
      <ProductActionsMenu
        variant="floating"
        title={page.title}
        viewCount={viewCount}
        backHref={`/checkout/${slug}`}
        slug={slug}
        page="preview"
        isLoggedIn={!!user}
        userName={(user?.user_metadata?.full_name as string | undefined) || user?.email || null}
        pageId={page.id}
        liked={liked}
        likeCount={page.like_count ?? 0}
      />
      <PreviewBuyBar
        href={buyHref}
        external={!!externalBuyLink}
        calendar={calendarMode}
        label={buyLabel}
        priceText={priceText}
        note={buyNote}
        autoRevealMs={autoRevealMs}
        slug={slug}
        ctaAction={calendarMode ? "calendar" : externalBuyLink ? "buy_link" : "buy"}
      />
    </>
  );
}
