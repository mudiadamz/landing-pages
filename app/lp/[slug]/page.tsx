import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getLandingPageBySlug, getLandingPageForCheckout, getProductsByIds, getNextInSeries, getBundleContaining } from "@/lib/actions/landing-pages";
import { isUpcoming } from "@/lib/product-status";
import { ComingSoon } from "@/components/coming-soon";
import { buildMetaDescription } from "@/lib/seo";
import { guardPreviewHtml } from "@/lib/preview-guard";
import { PreviewBuyBar } from "../preview-buy-bar";
import { PreviewSurface } from "../preview-surface";
import { PreviewGuardClient } from "../preview-guard-client";
import { PdfPreview } from "@/components/pdf-preview";
import { EpubReader } from "@/components/epub-reader";
import { ReaderEndPanel } from "@/components/reader-end-panel";
import { EpubBootSplash } from "@/components/epub-boot-splash";
import { BootSplashDismiss } from "@/components/boot-splash-dismiss";
import { ProductActionsMenu } from "@/components/product-actions";
import { getMyLike } from "@/lib/actions/likes";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";
import { ViewTracker } from "@/components/view-tracker";
import { ProductTracker } from "@/components/product-tracker";
import { ImmersiveController } from "@/components/immersive-controller";

const getPageBySlug = cache((slug: string) => getLandingPageBySlug(slug));
const getCheckoutData = cache((slug: string) => getLandingPageForCheckout(slug));

type Props = { params: Promise<{ slug: string }> };

/** "Gratis" or a formatted rupiah price, using the discount when there is one. */
function priceTextOf(
  isFree?: boolean | null,
  price?: number | null,
  discount?: number | null,
): string {
  const display = (discount ?? 0) > 0 ? discount! : price ?? 0;
  if (isFree || display <= 0) return "Gratis";
  return `Rp ${display.toLocaleString("id-ID")}`;
}

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
  const ogImage = checkoutData?.thumbnail_landscape_url || checkoutData?.thumbnail_url;
  const images = ogImage ? [ogImage] : undefined;
  return {
    title: page.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: page.title, description, url, images, type: "website" },
    twitter: { card: "summary_large_image", title: page.title, description, images },
  };
}

/**
 * The shell renders with no data at all: the cover URL needs only the slug, so
 * this flushes to the browser immediately while the (dynamic, auth-dependent)
 * preview below streams in behind it. Previously every DB call had to finish
 * before the first byte left the server — half a second of blank screen before
 * the cover even existed in the HTML.
 */
export default async function LandingPageView({ params }: Props) {
  const { slug } = await params;
  return (
    <>
      <EpubBootSplash key={slug} coverUrl={`/api/epub-cover/${slug}`} />
      <Suspense fallback={null}>
        <PreviewContent slug={slug} />
      </Suspense>
    </>
  );
}

async function PreviewContent({ slug }: { slug: string }) {
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  // Preview source: an uploaded PDF or external link is embedded directly;
  // otherwise the inline HTML is rendered (with anti-copy guards).
  const previewUrl = page.preview_url?.trim() || null;
  const previewUrlDark = page.preview_url_dark?.trim() || null;

  // "deliverable" preview reuses the product's own PDF/EPUB deliverable (private
  // bucket) — sign it so the free preview can read the same file. EPUB wins when
  // both exist.
  let dvEpubUrl: string | null = null;
  let dvPdfUrl: string | null = null;
  let dvPdfUrlDark: string | null = null;
  if (page.preview_type === "deliverable") {
    if (page.story_epub_url) {
      dvEpubUrl = await getSignedDownloadUrl(page.story_epub_url);
    } else if (page.story_pdf_url) {
      dvPdfUrl = await getSignedDownloadUrl(page.story_pdf_url);
      if (page.story_pdf_url_dark) dvPdfUrlDark = await getSignedDownloadUrl(page.story_pdf_url_dark);
    }
  }

  // Effective preview URLs (deliverable-signed when applicable). A PDF preview
  // needs at least one file; if only the dark one exists, use it as the default.
  const epubUrl = dvEpubUrl ?? (page.preview_type === "epub" ? previewUrl : null);
  const pdfLight = dvPdfUrl ?? (page.preview_type === "pdf" ? previewUrl ?? previewUrlDark : null);
  const pdfDark = dvPdfUrl ? dvPdfUrlDark : page.preview_type === "pdf" ? previewUrlDark : null;

  // Next instalment (if this product is part of a series) for the end-of-read CTA.
  const nextInSeries = page.next_product_id ? await getNextInSeries(page.next_product_id) : null;
  // A bundle that includes this product — offered at the end of the read.
  const bundleOffer = await getBundleContaining(page.id);

  const embedEpub = !!epubUrl;
  const embedPdf = !!pdfLight && !embedEpub;
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
  // EPUB pages inside sandboxed iframes can't report scroll either, so it uses
  // the same timed reveal fallback as external links.
  const autoRevealMs =
    embedLink || embedEpub
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

  // A logged-out visitor tapping the buy button would land on a checkout page
  // whose only content is a login prompt — so send them to the login screen
  // directly, with the product carried along and ?pay=1 so the purchase (or the
  // free claim) continues by itself as soon as they're in. Free products need an
  // account too, so they take the same path.
  const internalCheckout = !calendarMode && !externalBuyLink;
  // ?pay=1 continues the action on arrival rather than showing the same button
  // again — for a signed-in visitor that means going straight to payment.
  const effectiveBuyHref = !internalCheckout
    ? buyHref
    : user
      ? `/checkout/${slug}?pay=1`
      : `/login?next=${encodeURIComponent(`/checkout/${slug}?pay=1`)}`;

  // Scheduled but not yet released: non-owners see a countdown, not the preview.
  const isOwner = !!user && page.user_id === user.id;
  if (isUpcoming(page.available_at, isOwner)) {
    return (
      <div className="lp-reader flex w-full items-center justify-center overflow-y-auto p-4">
        <ComingSoon title={page.title} thumbnailUrl={page.thumbnail_url} target={page.available_at!} />
      </div>
    );
  }

  return (
    <>
      <PreviewGuardClient />
      <ImmersiveController />
      <ViewTracker slug={slug} />
      <ProductTracker slug={slug} page="preview" />
      {/* Anything that isn't the EPUB reader owns its own loading UI, so retire
          the shell's cover splash as soon as we know which preview this is. */}
      {!embedEpub && <BootSplashDismiss />}
      {embedEpub ? (
        // Inline EPUB — rendered directly in the DOM and flows in the window, so
        // scroll, taps, focus mode and the iOS address bar are all native.
        <div className="w-full">
          <EpubReader
            url={epubUrl as string}
            slug={slug}
            title={page.title}
            storageKey={`lp-epub:${slug}`}
          />
          <ReaderEndPanel
            next={
              nextInSeries
                ? {
                    slug: nextInSeries.slug,
                    title: nextInSeries.title,
                    thumbnailUrl: nextInSeries.thumbnail_url,
                    priceText: priceTextOf(
                      nextInSeries.is_free,
                      nextInSeries.price,
                      nextInSeries.price_discount,
                    ),
                  }
                : null
            }
            related={related.map((r) => ({
              slug: r.slug,
              title: r.title,
              thumbnailUrl: r.thumbnail_url,
              priceText: priceTextOf(r.is_free, r.price, r.price_discount),
            }))}
            bundle={
              bundleOffer
                ? {
                    title: bundleOffer.title,
                    slug: bundleOffer.slug,
                    itemCount: bundleOffer.bundle_product_ids?.length ?? 0,
                    note: bundleOffer.bundle_note,
                    priceText: priceTextOf(
                      bundleOffer.is_free,
                      bundleOffer.price,
                      bundleOffer.price_discount,
                    ),
                  }
                : null
            }
            buyHref={effectiveBuyHref}
            buyLabel={buyLabel}
            priceText={priceText}
            note={buyNote}
          />
        </div>
      ) : (
        <div className="lp-reader sticky top-0 w-full overflow-hidden">
          <PreviewSurface mode={embedPdf ? "pdf" : embedLink ? "link" : "html"}>
            {embedPdf ? (
              // Render with pdf.js (react-pdf), lazily page-by-page, so a heavy PDF
              // streams in as the user scrolls instead of loading all at once.
              <PdfPreview
                url={pdfLight as string}
                urlDark={pdfDark}
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
        </div>
      )}
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
        epub={embedEpub}
      />
      <PreviewBuyBar
        href={effectiveBuyHref}
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
