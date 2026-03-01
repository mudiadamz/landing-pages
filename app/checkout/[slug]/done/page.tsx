import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ resultCode?: string }> };

export default async function CheckoutDonePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { resultCode } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const success = resultCode === "00";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} />

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
              Terima kasih. Pembelian Anda telah tercatat. Silakan cek panel untuk mengakses landing page.
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

        <div className="flex gap-3">
          <Link
            href={success ? "/panel" : `/checkout/${slug}`}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity"
          >
            {success ? "Ke Panel" : "Coba lagi"}
          </Link>
          <Link
            href="/"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--background)] transition-colors"
          >
            Beranda
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
