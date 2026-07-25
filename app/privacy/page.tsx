import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/actions/landing-pages";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Kebijakan privasi ADM.UIUX. Cara kami mengumpulkan, menggunakan, dan melindungi informasi Anda.",
};

export default async function PrivacyPage() {
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
              Kebijakan Privasi
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Terakhir diperbarui: {new Date().toLocaleDateString("id-ID")}
            </p>
            <div className="space-y-4 text-[var(--muted)] leading-relaxed text-sm">
              <p>
                Privasi Anda penting bagi kami. Kebijakan ini menjelaskan cara kami mengumpulkan, menggunakan, membagikan, dan melindungi informasi Anda saat menggunakan layanan ADM.UIUX. Kami berusaha mengikuti prinsip Undang-Undang Pelindungan Data Pribadi (UU PDP) Indonesia.
              </p>

              <h2 className="text-foreground font-medium text-base pt-2">Informasi yang Kami Kumpulkan</h2>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-foreground">Data akun</strong> — nama dan email saat Anda mendaftar.</li>
                <li><strong className="text-foreground">Data pembelian</strong> — riwayat transaksi dan template yang Anda beli.</li>
                <li><strong className="text-foreground">Data pembayaran</strong> — diproses oleh payment gateway kami; kami tidak menyimpan nomor kartu Anda.</li>
                <li><strong className="text-foreground">Data penggunaan</strong> — interaksi dasar dengan situs untuk analitik dan peningkatan layanan.</li>
                <li><strong className="text-foreground">Data sesi &amp; teknis</strong> — alamat IP dan perkiraan lokasi (negara/kota/ISP), sumber rujukan/kampanye (UTM), jenis perangkat/browser, halaman yang Anda kunjungi, dan lama kunjungan. Kami memakainya secara internal (first-party) untuk memahami minat pengunjung dan efektivitas promosi.</li>
              </ul>

              <h2 className="text-foreground font-medium text-base pt-2">Cara Kami Menggunakan Informasi Anda</h2>
              <p>
                Untuk menyediakan dan meningkatkan layanan, memproses transaksi dan memberi akses ke pembelian, mengirim email terkait akun/pembelian, serta menjaga keamanan dan mematuhi kewajiban hukum.
              </p>

              <h2 className="text-foreground font-medium text-base pt-2">Pihak Ketiga (Sub-pemroses)</h2>
              <p>
                Kami menggunakan penyedia layanan tepercaya untuk menjalankan platform. Mereka hanya memproses data seperlunya untuk fungsinya:
              </p>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-foreground">Supabase</strong> — database, autentikasi, dan penyimpanan file.</li>
                <li><strong className="text-foreground">Duitku</strong> — pemrosesan pembayaran (menerima data tagihan yang diperlukan untuk transaksi).</li>
                <li><strong className="text-foreground">Vercel</strong> — hosting aplikasi dan analitik performa dasar.</li>
                <li><strong className="text-foreground">Resend</strong> — pengiriman email transaksional.</li>
                <li><strong className="text-foreground">Tawk.to</strong> — live chat dukungan (jika diaktifkan).</li>
                <li><strong className="text-foreground">Google Analytics &amp; Meta Pixel</strong> — pengukuran konversi (jika diaktifkan).</li>
              </ul>

              <h2 className="text-foreground font-medium text-base pt-2">Cookie</h2>
              <p>
                Kami menggunakan cookie yang diperlukan untuk sesi login dan preferensi (mis. tema), serta—jika diaktifkan—cookie analitik untuk memahami penggunaan situs. Anda dapat mengatur cookie lewat pengaturan browser.
              </p>

              <h2 className="text-foreground font-medium text-base pt-2">Penyimpanan Data</h2>
              <p>
                Kami menyimpan data akun dan pembelian selama akun Anda aktif atau selama diperlukan untuk menyediakan layanan dan memenuhi kewajiban hukum/akuntansi. Anda dapat meminta penghapusan kapan saja (lihat di bawah).
              </p>

              <h2 className="text-foreground font-medium text-base pt-2">Keamanan Data</h2>
              <p>
                Kami menerapkan langkah keamanan yang sesuai (enkripsi saat transit, kontrol akses) untuk melindungi data pribadi Anda mengikuti praktik standar industri.
              </p>

              <h2 className="text-foreground font-medium text-base pt-2">Hak Anda</h2>
              <p>
                Sesuai UU PDP, Anda berhak mengakses, memperbaiki, dan menghapus data pribadi Anda, menarik persetujuan, serta meminta pembatasan pemrosesan. Untuk menggunakan hak ini, hubungi kami di{" "}
                <a href="mailto:admin@admuiux.com" className="text-[var(--primary)] hover:underline font-medium">
                  admin@admuiux.com
                </a>
                .
              </p>

              <p>
                Untuk pertanyaan terkait kebijakan ini, hubungi kami lewat{" "}
                <a href="mailto:admin@admuiux.com" className="text-[var(--primary)] hover:underline font-medium">
                  admin@admuiux.com
                </a>{" "}
                atau halaman Kontak.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
