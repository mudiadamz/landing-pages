import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { getLandingPageBySlug, getLandingPageForCheckout, getProductsByIds, getNextInSeries, getBundleContaining } from "@/lib/actions/landing-pages";
import { isUpcoming } from "@/lib/product-status";
import { ComingSoon } from "@/components/coming-soon";
import { buildMetaDescription } from "@/lib/seo";
import { PopupBanner } from "@/components/popup-banner";
import { activePopup } from "@/lib/popup-config";
import { getPopupBanner } from "@/lib/actions/site-settings";
import { guardPreviewHtml } from "@/lib/preview-guard";
import { PreviewSurface } from "../preview-surface";
import { PreviewGuardClient } from "../preview-guard-client";
import { PdfPreview } from "@/components/pdf-preview";
import { EpubReader } from "@/components/epub-reader";
import { epubVersionToken } from "@/lib/epub-version";
import { ReaderEndPanel } from "@/components/reader-end-panel";
import { EpubBootSplash } from "@/components/epub-boot-splash";
import { ReaderScrollHint } from "@/components/reader-scroll-hint";
import { ReaderPageIndicator } from "@/components/reader-page-indicator";
import { BootSplashDismiss } from "@/components/boot-splash-dismiss";
import { ProductActionsMenu } from "@/components/product-actions";
import { currentSite } from "@/lib/site-resolve";
import { getMyLike } from "@/lib/actions/likes";
import { getSignedDownloadUrl } from "@/lib/actions/downloads";
import { ViewTracker } from "@/components/view-tracker";
import { ProductTracker } from "@/components/product-tracker";
import { ImmersiveController } from "@/components/immersive-controller";
import { requestLocale } from "@/lib/i18n/request";
import { t } from "@/lib/i18n";

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
  const url = `/preview/${slug}`;
  const ogImage = checkoutData?.thumbnail_landscape_url || checkoutData?.thumbnail_url;
  const images = ogImage ? [ogImage] : undefined;
  return {
    title: page.title,
    description,
    /**
     * Out of the index: this page gives paid content away for free, and an indexed
     * excerpt is a scraper's front door.
     *
     * openGraph and twitter stay — they are NOT search indexing. They are what
     * renders the link card when the URL is pasted into Instagram, WhatsApp or a
     * DM, which is exactly how this page gets traffic. Stripping them would make
     * every shared link and every ad creative look broken.
     *
     * `canonical` points at the checkout page instead of itself: the product's
     * indexable home is /checkout/[slug], so any crawler that reaches the preview
     * anyway is told where the real page is.
     */
    robots: { index: false, follow: false, nocache: true },
    alternates: { canonical: `/checkout/${slug}` },
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
  const [page, locale] = await Promise.all([getPageBySlug(slug), requestLocale()]);
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

  // "excerpt" reads the same file the buyer gets, truncated by the chapter
  // endpoint. Deliberately NOT signed here: handing the browser a URL to the
  // complete book would make the cut decorative, since the reader falls back to
  // downloading the archive whole when the text endpoint is unavailable.
  const epubExcerpt = page.preview_type === "excerpt" && !!page.story_epub_url;

  // Effective preview URLs (deliverable-signed when applicable). A PDF preview
  // needs at least one file; if only the dark one exists, use it as the default.
  const epubUrl = dvEpubUrl ?? (page.preview_type === "epub" ? previewUrl : null);
  const pdfLight = dvPdfUrl ?? (page.preview_type === "pdf" ? previewUrl ?? previewUrlDark : null);
  const pdfDark = dvPdfUrl ? dvPdfUrlDark : page.preview_type === "pdf" ? previewUrlDark : null;

  // Next instalment (if this product is part of a series) for the end-of-read CTA.
  const nextInSeries = page.next_product_id ? await getNextInSeries(page.next_product_id) : null;
  // A bundle that includes this product — offered at the end of the read.
  const bundleOffer = await getBundleContaining(page.id);

  // Which file the chapters come from, so an edited book isn't served from a
  // day-old edge cache (lib/epub-version.ts).
  // Everything that changes what the preview endpoints return. The cut percent
  // is in here because an excerpt serves a slice of an UNCHANGED archive — the
  // file stamp cannot see that decision move. preview_purged_at is the manual
  // override, for when a seller wants the edge dropped now.
  const previewVariant = [
    page.preview_type ?? "",
    page.preview_cut_percent ?? "",
    page.preview_purged_at ?? "",
  ].join("|");
  const epubVersion = epubVersionToken(
    page.preview_type === "deliverable" || page.preview_type === "excerpt"
      ? page.story_epub_url
      : page.preview_url,
    previewVariant,
  );

  const embedEpub = !!epubUrl || epubExcerpt;
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

  // A gated preview asks a different question. "Beli sekarang" is a shop verb;
  // the reader stopped mid-chapter wants to know how to keep reading, so the
  // default answers that instead. A seller's own cta_label still wins.
  const defaultLabel = calendarMode
    ? t("product.ctaActionCalendar", undefined, locale)
    : epubExcerpt
      ? showAsFree
        ? t("preview.openAllChapters", undefined, locale)
        : t("preview.readToTheEnd", undefined, locale)
      : showAsFree
        ? t("checkout.getFree", undefined, locale)
        : t("checkout.buyNow", undefined, locale);
  const buyLabel = checkout?.cta_label?.trim() || defaultLabel;
  const priceText = showAsFree ? null : `Rp ${displayPrice.toLocaleString("id-ID")}`;
  const buyNote =
    checkout?.cta_note?.trim() ||
    (epubExcerpt ? t("preview.fullAccessNote", undefined, locale) : null);

  const buyHref = calendarMode
    ? `/api/calendar/${slug}`
    : externalBuyLink ?? `/checkout/${slug}`;


  const viewCount = checkout?.view_count ?? 0;

  // For the "Masuk dengan Google" item in the actions menu (logged-out only)
  // and the like button's current state.
  const db = await createClient();
  const [{ data: { user } }, liked, related, popupConfig] = await Promise.all([
    db.auth.getUser(),
    getMyLike(page.id),
    getProductsByIds(page.related_product_ids ?? []),
    // Joins the existing parallel fetch rather than adding a waterfall, and is
    // an unstable_cache hit after the first request, so it costs the preview
    // nothing measurable.
    getPopupBanner(),
  ]);
  const popup = activePopup(popupConfig);

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

  // The one and only purchase prompt, at the end of the read. There is no longer
  // a floating CTA over the preview: reading is the product, and a card parked on
  // top of it was interrupting the thing the visitor came for. Shared by the EPUB
  // and PDF readers — the PDF takes it as a slot, since it scrolls inside its own
  // container and anything after the viewer would be unreachable.
  const endPanel = (
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
      external={!!externalBuyLink}
      slug={slug}
      ctaAction={calendarMode ? "calendar" : externalBuyLink ? "buy_link" : "buy"}
      gated={epubExcerpt}
    />
  );

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
            locale={locale}
            // Empty for an excerpt: there is no archive the browser may fetch.
            url={epubUrl ?? ""}
            slug={slug}
            title={page.title}
            version={epubVersion}
            storageKey={`lp-epub:${slug}`}
          />
          {/* Bottom fade + idle chevron, and the first-scroll event they're
              judged by. Only for the inline reader: it's the one preview that
              flows in the document, so window scroll is observable. */}
          <ReaderScrollHint slug={slug} />
          {endPanel}
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
                endPanel={endPanel}
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
                srcDoc={guardPreviewHtml(page.html_content)}
                title={page.title}
                className="w-full h-full min-h-full border-0 block"
                sandbox="allow-scripts allow-same-origin allow-modals"
              />
            )}
          </PreviewSurface>
        </div>
      )}
      {/* Popup banner. Nothing is fetched or rendered until it opens — see
          components/popup-banner.tsx. The config read is an unstable_cache hit,
          so the preview pays nothing for it. */}
      {popup && <PopupBanner config={popup} slug={slug} />}
      <ProductActionsMenu
        variant="floating"
        locale={locale}
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
      {/* Where the buy CTA used to float: the reader's place in the text. A
          cross-origin link preview can't be measured, so it gets nothing. */}
      {!embedLink && (
        <ReaderPageIndicator mode={embedEpub ? "window" : "event"} slug={slug} />
      )}
    </>
  );
}
