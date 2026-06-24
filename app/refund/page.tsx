import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Kebijakan Pengembalian Dana",
  description:
    "Garansi 7 hari ADM.UIUX: file rusak, tidak lengkap, atau tidak sesuai deskripsi kami perbaiki atau kembalikan dananya. Setiap template bisa di-preview gratis sebelum beli.",
  alternates: { canonical: "/refund" },
};

export default async function RefundPage() {
  const supabase = await createClient();
  const [
    { data: { user } },
    categories,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getCategories(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader user={user} categories={categories} />
      <main className="flex-1">
        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Kebijakan Pengembalian Dana
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Terakhir diperbarui: {new Date().toLocaleDateString("id-ID")}
            </p>

            <div className="space-y-4 text-[var(--muted)] leading-relaxed text-sm">
              <p>
                Produk kami berupa template HTML dan digital assets yang dikirim secara digital. Karena itu, setiap produk bisa Anda{" "}
                <Link href="/" className="text-[var(--primary)] hover:underline font-medium">
                  preview gratis
                </Link>{" "}
                secara lengkap sebelum membeli—jadi Anda tahu persis apa yang Anda dapat.
              </p>

              <h2 className="text-foreground font-medium text-base pt-2">Garansi 7 hari</h2>
              <p>
                Kami memberi garansi 7 hari sejak tanggal pembelian. Jika file yang Anda terima{" "}
                <strong className="text-foreground">rusak, tidak lengkap, atau tidak sesuai dengan deskripsi/preview</strong>, kami akan memperbaikinya, atau—jika tidak bisa diperbaiki—mengembalikan dana Anda sepenuhnya.
              </p>

              <h2 className="text-foreground font-medium text-base pt-2">Yang tidak tercakup</h2>
              <p>
                Karena setiap template sudah bisa di-preview gratis sebelum dibeli, pengembalian dana karena{" "}
                <strong className="text-foreground">berubah pikiran atau perbedaan selera</strong>{" "}
                tidak berlaku. Begitu pula jika file sudah diunduh dan sesuai deskripsi.
              </p>

              <h2 className="text-foreground font-medium text-base pt-2">Cara mengajukan</h2>
              <ol className="space-y-2 list-decimal list-inside">
                <li>
                  Hubungi kami lewat{" "}
                  <Link href="/contact" className="text-[var(--primary)] hover:underline font-medium">
                    halaman Kontak
                  </Link>{" "}
                  dalam 7 hari sejak pembelian.
                </li>
                <li>Sertakan email pembelian / bukti transaksi dan jelaskan masalahnya.</li>
                <li>
                  Kami merespons dalam 1–2 hari kerja. Jika disetujui, dana dikembalikan lewat metode pembayaran awal dalam 3–7 hari kerja (mengikuti proses payment gateway).
                </li>
              </ol>

              <p className="pt-2">
                Kebijakan ini melengkapi{" "}
                <Link href="/terms" className="text-[var(--primary)] hover:underline font-medium">
                  Ketentuan Layanan
                </Link>{" "}
                kami.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
