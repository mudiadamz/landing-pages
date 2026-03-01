import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLandingPageBySlug, getLandingPageForCheckout } from "@/lib/actions/landing-pages";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLandingPageBySlug(slug);
  if (!page) return { title: "Not found" };
  return { title: page.title };
}

export default async function LandingPageView({ params }: Props) {
  const { slug } = await params;
  const page = await getLandingPageBySlug(slug);
  if (!page) notFound();

  const checkoutData = await getLandingPageForCheckout(slug);
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
  const buyLabel = showAsFree ? "Ambil gratis" : "Beli sekarang";
  const isExternal = !showAsFree && isInternal === false && !!externalUrl;

  return (
    <>
      <iframe
        srcDoc={page.html_content}
        title={page.title}
        className="w-full h-full min-h-full border-0 block"
        sandbox="allow-scripts allow-same-origin allow-modals"
      />
      {checkoutData && (
        <Link
          href={buyHref}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-medium text-sm shadow-lg hover:opacity-95 active:scale-[0.98] transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {buyLabel}
        </Link>
      )}
    </>
  );
}
