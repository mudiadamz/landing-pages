import Image from "next/image";
import { getLandingPageForCheckout } from "@/lib/actions/landing-pages";

/**
 * Shown above the login form when the visitor was sent here mid-purchase, so
 * it's obvious what they're signing in *for*. Arriving at a bare login screen
 * after tapping "Beli sekarang" reads as a dead end.
 */
export async function CheckoutIntent({ next }: { next?: string }) {
  const slug = next?.match(/^\/checkout\/([^/?#]+)/)?.[1];
  if (!slug) return null;

  let product: Awaited<ReturnType<typeof getLandingPageForCheckout>> | null = null;
  try {
    product = await getLandingPageForCheckout(decodeURIComponent(slug));
  } catch {
    return null;
  }
  if (!product) return null;

  const isFree = product.is_free === true;
  const discount = product.price_discount ?? 0;
  const base = product.price ?? 0;
  const display = !isFree && discount > 0 ? discount : base;
  const showAsFree = isFree || display <= 0;
  const thumb = product.thumbnail_landscape_url || product.thumbnail_url;

  return (
    <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {showAsFree ? "Masuk untuk mengambil" : "Masuk untuk membeli"}
      </p>
      <div className="flex items-center gap-3">
        {thumb ? (
          <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
            <Image src={thumb} alt="" fill sizes="80px" className="object-cover" />
          </span>
        ) : (
          <span className="h-14 w-20 shrink-0 rounded-lg bg-[var(--background)]" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{product.title}</p>
          <p className="mt-0.5 text-sm font-medium text-[var(--primary)]">
            {showAsFree ? "Gratis" : `Rp ${display.toLocaleString("id-ID")}`}
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-xs text-[var(--muted)]">
        {showAsFree
          ? "Setelah masuk, produk langsung masuk ke akunmu."
          : "Setelah masuk, kamu langsung diarahkan ke pembayaran."}
      </p>
    </div>
  );
}
