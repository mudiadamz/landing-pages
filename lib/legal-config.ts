/* Legal page copy — types + shipped defaults, editable at /panel/legal.
 *
 * Settings, not rows. lib/actions/pages.ts draws the line: editorial pages are
 * "created and deleted by a person, so they cannot live in the key/value blob
 * that holds surfaces the code already knows the names of" — and it excludes
 * "the fixed legal pages" by name. These three ARE surfaces the code knows: the
 * routes exist, the footer links to them, the sitemap lists them, and no admin
 * may delete or rename one. So they live in lp_site_settings under
 * "legal_content", per site.
 *
 * Per site is the point of the change, not a side effect. A second storefront on
 * this deployment was previously serving ADM.UIUX's privacy policy, naming
 * ADM.UIUX's sub-processors and ADM.UIUX's contact address, as its own — which is
 * wrong in a way that matters more than a typo.
 *
 * Kept out of the "use server" action file so plain (non-async) values can be
 * imported by client and server components alike.
 */

/** Bodies are HTML, sanitised on write with lib/page-html and rendered inside
 *  `.page-prose` — the same pipeline the editorial pages use. */
export type LegalPageContent = {
  title: string;
  /** Meta description. Empty falls back to the first sentence of the body. */
  description: string;
  body: string;
};

export type LegalKey = "privacy" | "terms" | "refund";

export type LegalContent = Record<LegalKey, LegalPageContent> & {
  /**
   * ISO timestamp of the last save, shown as "Terakhir diperbarui".
   *
   * The pages used to print `new Date()`, so every one of them claimed to have
   * been revised today, every day, forever. A legal document that says that is
   * not merely stale, it is untrue — and a reader has no way to tell whether the
   * terms they agreed to last month are the ones on screen.
   */
  updatedAt: string | null;
};

export const LEGAL_KEYS: LegalKey[] = ["privacy", "terms", "refund"];

/** Route each key renders at — used by the panel's "view page" links. */
export const LEGAL_ROUTES: Record<LegalKey, string> = {
  privacy: "/privacy",
  terms: "/terms",
  refund: "/refund",
};

export const DEFAULT_LEGAL: LegalContent = {
  updatedAt: null,

  privacy: {
    title: "Kebijakan Privasi",
    description:
      "Kebijakan privasi ADM.UIUX. Cara kami mengumpulkan, menggunakan, dan melindungi informasi Anda.",
    body: `<p>Privasi Anda penting bagi kami. Kebijakan ini menjelaskan cara kami mengumpulkan, menggunakan, membagikan, dan melindungi informasi Anda saat menggunakan layanan ADM.UIUX. Kami berusaha mengikuti prinsip Undang-Undang Pelindungan Data Pribadi (UU PDP) Indonesia.</p>
<h2>Informasi yang Kami Kumpulkan</h2>
<ul>
<li><strong>Data akun</strong> — nama dan email saat Anda mendaftar.</li>
<li><strong>Data pembelian</strong> — riwayat transaksi dan template yang Anda beli.</li>
<li><strong>Data pembayaran</strong> — diproses oleh payment gateway kami; kami tidak menyimpan nomor kartu Anda.</li>
<li><strong>Data penggunaan</strong> — interaksi dasar dengan situs untuk analitik dan peningkatan layanan.</li>
<li><strong>Data sesi &amp; teknis</strong> — alamat IP dan perkiraan lokasi (negara/kota/ISP), sumber rujukan/kampanye (UTM), jenis perangkat/browser, halaman yang Anda kunjungi, dan lama kunjungan. Kami memakainya secara internal (first-party) untuk memahami minat pengunjung dan efektivitas promosi.</li>
</ul>
<h2>Cara Kami Menggunakan Informasi Anda</h2>
<p>Untuk menyediakan dan meningkatkan layanan, memproses transaksi dan memberi akses ke pembelian, mengirim email terkait akun/pembelian, serta menjaga keamanan dan mematuhi kewajiban hukum.</p>
<h2>Pihak Ketiga (Sub-pemroses)</h2>
<p>Kami menggunakan penyedia layanan tepercaya untuk menjalankan platform. Mereka hanya memproses data seperlunya untuk fungsinya:</p>
<ul>
<li><strong>Duitku</strong> — pemrosesan pembayaran (menerima data tagihan yang diperlukan untuk transaksi).</li>
<li><strong>Penyedia server (VPS)</strong> — hosting aplikasi, database, dan penyimpanan file.</li>
<li><strong>Google</strong> — masuk dengan akun Google (jika Anda memilihnya).</li>
<li><strong>Resend</strong> — pengiriman email transaksional.</li>
<li><strong>Tawk.to</strong> — live chat dukungan (jika diaktifkan).</li>
<li><strong>Google Analytics &amp; Meta Pixel</strong> — pengukuran konversi (jika diaktifkan).</li>
</ul>
<h2>Cookie</h2>
<p>Kami menggunakan cookie yang diperlukan untuk sesi login dan preferensi (mis. tema), serta—jika diaktifkan—cookie analitik untuk memahami penggunaan situs. Anda dapat mengatur cookie lewat pengaturan browser.</p>
<h2>Penyimpanan Data</h2>
<p>Kami menyimpan data akun dan pembelian selama akun Anda aktif atau selama diperlukan untuk menyediakan layanan dan memenuhi kewajiban hukum/akuntansi. Anda dapat meminta penghapusan kapan saja (lihat di bawah).</p>
<h2>Keamanan Data</h2>
<p>Kami menerapkan langkah keamanan yang sesuai (enkripsi saat transit, kontrol akses) untuk melindungi data pribadi Anda mengikuti praktik standar industri.</p>
<h2>Hak Anda</h2>
<p>Sesuai UU PDP, Anda berhak mengakses, memperbaiki, dan menghapus data pribadi Anda, menarik persetujuan, serta meminta pembatasan pemrosesan. Untuk menggunakan hak ini, hubungi kami di <a href="mailto:admin@admuiux.com">admin@admuiux.com</a>.</p>
<p>Untuk pertanyaan terkait kebijakan ini, hubungi kami lewat <a href="mailto:admin@admuiux.com">admin@admuiux.com</a> atau <a href="/contact">halaman Kontak</a>.</p>`,
  },

  terms: {
    title: "Ketentuan Layanan",
    description: "Ketentuan layanan ADM.UIUX. Syarat dan ketentuan penggunaan produk digital.",
    body: `<p>Dengan menggunakan layanan kami, Anda setuju dengan ketentuan ini. Mohon baca dengan saksama.</p>
<h2>Penggunaan Layanan</h2>
<p>Anda setuju menggunakan platform produk digital kami sesuai ketentuan ini dan hukum yang berlaku. Anda bertanggung jawab atas konten yang dibuat dan dibagikan.</p>
<h2>Akun</h2>
<p>Anda wajib memberikan informasi yang akurat saat membuat akun. Anda bertanggung jawab menjaga keamanan kredensial Anda.</p>
<h2>Pembelian</h2>
<p>Pembelian produk digital berbayar mengikuti ketentuan penjual. Pengembalian dana diatur dalam <a href="/refund">Kebijakan Pengembalian Dana</a> (garansi 7 hari untuk file rusak/tidak sesuai). Dukungan teknis (support 1 bulan) berlaku untuk setiap pembelian berbayar.</p>
<h2>Perubahan</h2>
<p>Kami dapat memperbarui ketentuan ini sewaktu-waktu. Penggunaan layanan setelah perubahan berarti Anda menerima ketentuan terbaru.</p>
<p>Untuk pertanyaan terkait ketentuan ini, hubungi kami melalui link di <a href="/contact">halaman Kontak</a>.</p>`,
  },

  refund: {
    title: "Kebijakan Pengembalian Dana",
    description:
      "Kebijakan pengembalian dana ADM.UIUX. Garansi 7 hari untuk file rusak atau tidak sesuai deskripsi.",
    body: `<p>Produk kami berupa template HTML dan digital assets yang dikirim secara digital. Karena itu, setiap produk bisa Anda <a href="/">preview gratis</a> secara lengkap sebelum membeli—jadi Anda tahu persis apa yang Anda dapat.</p>
<h2>Garansi 7 hari</h2>
<p>Kami memberi garansi 7 hari sejak tanggal pembelian. Jika file yang Anda terima <strong>rusak, tidak lengkap, atau tidak sesuai dengan deskripsi/preview</strong>, kami akan memperbaikinya, atau—jika tidak bisa diperbaiki—mengembalikan dana Anda sepenuhnya.</p>
<h2>Yang tidak tercakup</h2>
<p>Karena setiap template sudah bisa di-preview gratis sebelum dibeli, pengembalian dana karena <strong>berubah pikiran atau perbedaan selera</strong> tidak berlaku. Begitu pula jika file sudah diunduh dan sesuai deskripsi.</p>
<h2>Cara mengajukan</h2>
<ol>
<li>Hubungi kami lewat <a href="/contact">halaman Kontak</a> dalam 7 hari sejak pembelian.</li>
<li>Sertakan email pembelian / bukti transaksi dan jelaskan masalahnya.</li>
<li>Kami merespons dalam 1–2 hari kerja. Jika disetujui, dana dikembalikan lewat metode pembayaran awal dalam 3–7 hari kerja (mengikuti proses payment gateway).</li>
</ol>
<p>Kebijakan ini melengkapi <a href="/terms">Ketentuan Layanan</a> kami.</p>`,
  },
};

/** Merge a stored value onto the defaults so a missing field never blanks a page. */
export function normalizeLegal(raw: unknown): LegalContent {
  if (!raw || typeof raw !== "object") return DEFAULT_LEGAL;
  const v = raw as Partial<LegalContent>;

  const page = (key: LegalKey): LegalPageContent => {
    const d = DEFAULT_LEGAL[key];
    const p = (v[key] ?? {}) as Partial<LegalPageContent>;
    return {
      // An empty title would render a page with no heading, so blanks fall back
      // rather than being stored as an override.
      title: p.title?.trim() || d.title,
      description: typeof p.description === "string" ? p.description : d.description,
      body: p.body?.trim() || d.body,
    };
  };

  const stamp = typeof v.updatedAt === "string" && v.updatedAt.trim() ? v.updatedAt : null;

  return {
    privacy: page("privacy"),
    terms: page("terms"),
    refund: page("refund"),
    updatedAt: stamp,
  };
}
