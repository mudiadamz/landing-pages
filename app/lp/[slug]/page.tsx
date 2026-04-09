import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLandingPageBySlug, getLandingPageForCheckout } from "@/lib/actions/landing-pages";
import { PreviewBar } from "../preview-bar";

const getPageBySlug = cache((slug: string) => getLandingPageBySlug(slug));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return { title: "Not found" };
  return { title: page.title };
}

export default async function LandingPageView({ params }: Props) {
  const { slug } = await params;
  const [page, checkoutData] = await Promise.all([
    getPageBySlug(slug),
    getLandingPageForCheckout(slug),
  ]);
  if (!page) notFound();
  const price = checkoutData?.price ?? 0;
  const priceDiscount = checkoutData?.price_discount ?? 0;
  const isFree = checkoutData?.is_free === true;
  const hasDiscount = !isFree && priceDiscount > 0;
  const displayPrice = hasDiscount ? priceDiscount : price;
  const showAsFree = isFree || displayPrice <= 0;
  const isInternal = checkoutData?.purchase_type !== "external";
  const externalUrl = checkoutData?.purchase_link?.trim() || null;

  const buyHref = showAsFree
    ? `/checkout/${slug}`
    : isInternal
      ? `/checkout/${slug}`
      : externalUrl || `/checkout/${slug}`;
  const buyLabel = showAsFree ? "Ambil gratis" : "Checkout";
  const buyDescription = showAsFree
    ? "Dapatkan file gratis, akses di panel"
    : isInternal
      ? "Bayar aman, akses file di panel"
      : "Lanjut ke pembayaran di link eksternal";
  const isExternal = !showAsFree && isInternal === false && !!externalUrl;

  return (
    <>
      <iframe
        srcDoc={page.html_content}
        title={page.title}
        className="w-full h-full min-h-full border-0 block"
        sandbox="allow-scripts allow-same-origin allow-modals"
      />
      <PreviewBar
        buyHref={checkoutData ? buyHref : undefined}
        buyLabel={checkoutData ? buyLabel : undefined}
        buyDescription={checkoutData ? buyDescription : undefined}
        isExternal={isExternal}
      />
    </>
  );
}
