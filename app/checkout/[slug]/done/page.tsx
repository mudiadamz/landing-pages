import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { getCategories, getLandingPageForCheckout } from "@/lib/actions/landing-pages";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PurchaseTracker } from "@/components/purchase-tracker";

// Matches the Button component's secondary + md variant, so the story reader
// trigger sits inline with the other buttons.

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ resultCode?: string; merchantOrderId?: string }>;
};

export default async function CheckoutDonePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { resultCode, merchantOrderId } = await searchParams;
  const supabase = await createClient();
  const [
    { data: { user } },
    categories,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getCategories(),
  ]);

  const success = resultCode === "00";

  // Resolve the order value for the purchase event (success only).
  const checkoutData = success ? await getLandingPageForCheckout(slug) : null;
  const purchaseValue = (() => {
    if (!checkoutData || checkoutData.is_free) return 0;
    const price = checkoutData.price ?? 0;
    const discount = checkoutData.price_discount ?? 0;
    return discount > 0 ? discount : price;
  })();

  // Only offer the direct download once the purchase row exists — the Duitku
  // callback that records it may still be in flight, and /api/download would
  // 403 until then. RLS lets a user read their own purchases.
  let hasPurchase = false;
  if (success && checkoutData && user) {
    const { data: purchase } = await supabase
      .from("lp_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("landing_page_id", checkoutData.id)
      .maybeSingle();
    hasPurchase = !!purchase;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} categories={categories} />

      {success && checkoutData && (
        <PurchaseTracker
          orderId={merchantOrderId || `${slug}-${resultCode}`}
          value={purchaseValue}
          slug={slug}
          title={checkoutData.title}
        />
      )}

      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center justify-center text-center">
        {success ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Pembayaran berhasil
            </h1>
            <p className="text-[var(--muted)] mb-6">
              {hasPurchase
                ? "Terima kasih! File kamu siap. Download sekarang, atau akses kapan saja di panel."
                : "Terima kasih. Pembayaran sedang diproses — biasanya beberapa detik. Cek panel sebentar lagi untuk download."}
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
              <svg
                className="w-8 h-8 text-amber-600 dark:text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Pembayaran belum selesai
            </h1>
            <p className="text-[var(--muted)] mb-6">
              Pembayaran dibatalkan atau belum selesai. Anda dapat mencoba kembali kapan saja.
            </p>
          </>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {success ? (
            hasPurchase ? (
              <>
                {checkoutData?.zip_url && (
                  <Button
                    size="md"
                    href={`/api/download/${slug}`}
                    external
                    leftIcon={<DownloadIcon className="w-4 h-4" />}
                  >
                    Download
                  </Button>
                )}
                {(checkoutData?.story_epub_url || checkoutData?.story_pdf_url) && (
                  <Button variant="secondary" size="md" href={`/read/${slug}`}>
                    {checkoutData?.story_epub_url ? "Baca EPUB" : "Baca PDF"}
                  </Button>
                )}
                <Button variant="secondary" size="md" href="/panel">
                  Ke Panel
                </Button>
              </>
            ) : (
              <>
                <Button size="md" href="/panel">
                  Ke Panel
                </Button>
                <Button variant="secondary" size="md" href="/">
                  Beranda
                </Button>
              </>
            )
          ) : (
            <>
              <Button size="md" href={`/checkout/${slug}`}>
                Coba lagi
              </Button>
              <Button variant="secondary" size="md" href="/">
                Beranda
              </Button>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
