import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLandingPageBySlug, getLandingPageForCheckout } from "@/lib/actions/landing-pages";

const getPageBySlug = cache((slug: string) => getLandingPageBySlug(slug));

function CheckoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

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
      {checkoutData && (
        <Link
          href={buyHref}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          title={buyDescription}
          className="fixed bottom-4 right-4 z-50 flex flex-col items-center gap-0.5 px-4 py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-medium text-sm shadow-lg hover:opacity-95 active:scale-[0.97] active:opacity-90 transition-all duration-150"
        >
          <span className="flex items-center gap-2">
            <CheckoutIcon className="w-5 h-5" />
            {buyLabel}
          </span>
          <span className="text-xs font-normal opacity-90">{buyDescription}</span>
        </Link>
      )}
    </>
  );
}
