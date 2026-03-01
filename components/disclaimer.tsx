import Link from "next/link";

const faqs = [
  {
    q: "Landing page itu apa?",
    a: "Landing page adalah halaman web tunggal untuk kampanye atau produk tertentu. Biasanya digunakan untuk lead generation, penjualan, atau promosi. Template kami berbasis HTML siap pakai—tinggal edit konten sesuai kebutuhan.",
  },
  {
    q: "Bagaimana cara preview sebelum beli?",
    a: "Setiap landing page punya tombol Lihat. Klik untuk membuka preview di tab baru. Anda bisa cek tampilan dan struktur sebelum memutuskan membeli.",
  },
  {
    q: "Apakah bisa diedit setelah dibeli?",
    a: "Ya. Anda mendapat akses file HTML. Edit menggunakan code editor favorit Anda. Template dirancang sederhana agar mudah dimodifikasi.",
  },
  {
    q: "Bagaimana support 1 bulan itu?",
    a: "Setelah pembelian, Anda punya hak support selama 1 bulan. Bisa tanya seputar implementasi, bug, atau modifikasi dasar. Hubungi kami lewat link Kontak dengan bukti pembelian.",
  },
];

export function Disclaimer() {
  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20 border-t border-[var(--border)]">
      <div className="space-y-12 sm:space-y-16">
        {/* Disclaimer panjang */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-4">
            Disclaimer
          </h2>
          <div className="space-y-4 text-sm text-[var(--muted)] leading-relaxed">
            <p>
              Produk yang dijual di sini adalah template HTML landing page dan digital assets. Anda membeli hak penggunaan template, bukan lisensi eksklusif. Template boleh digunakan untuk proyek pribadi maupun komersial. Penggandaan atau redistribusi ke pihak ketiga tanpa izin tidak diperkenankan.
            </p>
            <p>
              Kami tidak menjamin template bebas dari bug. Kami melakukan testing dasar, tetapi penggunaan Anda mungkin berbeda. Dukungan teknis terbatas pada bantuan implementasi dan perbaikan bug selama periode garansi support 1 bulan.
            </p>
            <p>
              Pembelian landing page berbayar memakai link pembayaran eksternal. Pastikan Anda membeli dari sumber resmi (halaman ini). Kami tidak bertanggung jawab atas transaksi di luar platform.
            </p>
            <p>
              Dengan membeli atau mengambil template gratis, Anda dianggap telah membaca dan menyetujui disclaimer serta ketentuan layanan kami.
            </p>
          </div>
        </div>

        {/* Cara pembelian */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-4">
            Cara pembelian
          </h2>
          <ol className="space-y-3 text-sm text-[var(--muted)] leading-relaxed list-decimal list-inside">
            <li><strong className="text-foreground">Daftar akun</strong> — Klik Daftar di pojok kanan atas, isi email dan password.</li>
            <li><strong className="text-foreground">Lihat preview</strong> — Klik tombol Lihat pada landing page yang diminati untuk melihat tampilan lengkap.</li>
            <li><strong className="text-foreground">Klik Beli</strong> — Untuk template berbayar, klik Beli. Anda akan diarahkan ke halaman pembayaran.</li>
            <li><strong className="text-foreground">Lakukan pembayaran</strong> — Selesaikan pembayaran sesuai instruksi di halaman tersebut.</li>
            <li><strong className="text-foreground">Akses di Panel</strong> — Setelah pembayaran terkonfirmasi, landing page bisa diakses di Panel → Pembelian Saya.</li>
            <li><strong className="text-foreground">Template gratis</strong> — Klik Ambil gratis. Langsung tersimpan di akun Anda tanpa biaya.</li>
          </ol>
        </div>

        {/* Jaminan support */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-4">
            Jaminan support landing page 1 bulan
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed mb-4">
            Setiap pembelian landing page berbayar dilengkapi dukungan teknis selama <strong className="text-foreground">1 bulan</strong> sejak tanggal pembelian. Yang termasuk:
          </p>
          <ul className="space-y-2 text-sm text-[var(--muted)] leading-relaxed list-disc list-inside">
            <li>Bantuan implementasi (cara upload, deploy, integrasi dasar)</li>
            <li>Perbaikan bug pada kode template</li>
            <li>Panduan modifikasi sederhana (teks, gambar, warna)</li>
          </ul>
          <p className="text-sm text-[var(--muted)] leading-relaxed mt-4">
            Untuk memakai dukungan, hubungi kami lewat{" "}
            <Link href="/contact" className="text-[var(--primary)] hover:underline font-medium">
              halaman Kontak
            </Link>
            {" "}dengan menyertakan detail pembelian (email atau bukti transaksi). Kami akan merespons dalam 1–2 hari kerja.
          </p>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-6">
            FAQ
          </h2>
          <dl className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i}>
                <dt className="text-sm font-medium text-foreground mb-1.5">{faq.q}</dt>
                <dd className="text-sm text-[var(--muted)] leading-relaxed">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
