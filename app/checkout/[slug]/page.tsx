import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getLandingPageForCheckout } from "@/lib/actions/landing-pages";
import { CheckoutForm } from "./checkout-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

type Props = { params: Promise<{ slug: string }> };

function formatPrice(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    currencyDisplay: "symbol",
  }).format(value);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLandingPageForCheckout(slug);
  if (!page) return { title: "Checkout" };
  return { title: `Checkout — ${page.title}` };
}

export default async function CheckoutPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const page = await getLandingPageForCheckout(slug);
  if (!page) notFound();

  const isFree = page.is_free === true;
  const price = page.price ?? 0;
  const priceDiscount = page.price_discount ?? 0;
  const hasDiscount = !isFree && priceDiscount > 0;
  const displayPrice = hasDiscount ? priceDiscount : price;
  const showAsFree = isFree || displayPrice <= 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link
          href="/"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors mb-6 inline-block"
        >
          ← Kembali ke beranda
        </Link>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
          <div className="relative aspect-video bg-[var(--background)]">
            {page.thumbnail_url ? (
              <img
                src={page.thumbnail_url}
                alt={page.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--muted)] text-sm">
                {page.title}
              </div>
            )}
          </div>
          <div className="p-5 sm:p-6">
            <h1 className="text-xl font-semibold text-foreground">{page.title}</h1>
            <div className="mt-2 flex items-center gap-2">
              {showAsFree ? (
                <span className="text-lg font-medium text-[var(--primary)]">Gratis</span>
              ) : (
                <>
                  {hasDiscount && price > 0 && (
                    <span className="text-sm text-[var(--muted)] line-through">
                      {formatPrice(price)}
                    </span>
                  )}
                  <span className="text-lg font-medium text-foreground">
                    {formatPrice(displayPrice)}
                  </span>
                </>
              )}
            </div>

            <div className="mt-6">
              <CheckoutForm
                page={page}
                isLoggedIn={!!user}
                showAsFree={showAsFree}
                purchaseLink={page.purchase_link?.trim() || null}
              />
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
