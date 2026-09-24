/* Shared site-content types + defaults. Kept out of the "use server" action file
 * so plain (non-async) values can be imported by client & server components.
 *
 * Powers the editable homepage copy: the footer tagline and the long
 * "Ketentuan & lisensi / Cara pembelian / Jaminan support / FAQ" section.
 * Edited from /panel/content, stored as JSON in lp_site_settings.value
 * under key "site_content". */

export type HowToStep = { label: string; text: string };
export type FaqItem = { q: string; a: string };

/** Maker-proof card shown on homepage/category/checkout (FounderCredibility). */
export type FounderCard = {
  /** When false, the card isn't rendered anywhere. */
  enabled: boolean;
  name: string;
  /** Small line under the name, e.g. "Founder · software developer 15+ tahun". */
  role: string;
  /** Sentence before the contact link (a live template count may be prefixed). */
  bio: string;
  /** Public photo URL, or a local path like "/pas_foto.png". Empty → initial. */
  photoUrl: string;
  /** Contact link text + target rendered at the end of the bio. */
  contactLabel: string;
  contactHref: string;
  /**
   * Show the blue tick after the name on the storefront.
   *
   * The storefront's own claim about its owner — it asserts nothing about any
   * third party's verification programme. On in the default content, so it
   * appears without anyone having to find the switch; off is one checkbox away
   * in /panel/content.
   */
  verified: boolean;
  /**
   * Banner behind the top of the storefront homepage. Empty = no cover.
   *
   * Lives on the founder card because that is what it sits behind — the photo,
   * the name and the line under it — so the two are chosen together rather than
   * from opposite ends of the panel.
   */
  coverUrl: string;
  /**
   * `#rrggbb` tinting the browser toolbar on the homepage, so Safari's chrome
   * blends into the cover instead of ending it on a hard edge.
   *
   * A colour, not the image: `theme-color` is the only hook a page has into
   * browser chrome and it takes one flat value. Sampled from the top of the
   * cover when one is uploaded, and editable afterwards. Empty = leave the
   * toolbar alone.
   */
  coverThemeColor: string;
};

export type SiteContent = {
  /** One-line tagline in the site footer. */
  footerTagline: string;

  /** Founder credibility card. */
  founder: FounderCard;

  /* ---- Halaman Tentang ---- */
  aboutHeading: string;
  /** Body paragraphs. The author block below them comes from `founder`, so the
   *  person is not described twice in two places that can disagree. */
  aboutParagraphs: string[];
  aboutAuthorHeading: string;

  /* ---- Halaman Kontak ---- */
  contactHeading: string;
  contactIntro: string;
  /** Heading above the support contacts, shared by /about and /contact. */
  supportContactHeading: string;
  supportContactIntro: string;

  /** "Ketentuan & lisensi" block. */
  licenseHeading: string;
  licenseParagraphs: string[];

  /** "Cara pembelian" block. `label` is rendered bold, followed by ` — text`. */
  howToHeading: string;
  howToSteps: HowToStep[];

  /** "Jaminan support" block. `outro` is followed by a link to /contact. */
  supportHeading: string;
  supportIntro: string;
  supportPoints: string[];
  supportOutro: string;

  /** FAQ block. */
  faqHeading: string;
  faqs: FaqItem[];

  /**
   * Terms a seller must accept before applying to become a publisher.
   *
   * Shown inside the application form, not on a public page — it is a contract
   * between the seller and the marketplace, and the acceptance timestamp on
   * lp_profiles is what records agreement.
   */
  publisherTermsHeading: string;
  /** One paragraph per entry. Plain text; rendered as a scrollable list. */
  publisherTerms: string[];
};

export const DEFAULT_CONTENT: SiteContent = {
  // Empty: no placeholder tagline. Footer hides it until set in /panel/content.
  footerTagline: "",

  // Disabled + blank by default: the author/founder card names a real person, so
  // it ships off with no placeholder identity. Enable and fill it in /panel/content.
  founder: {
    enabled: false,
    name: "",
    role: "",
    bio: "",
    photoUrl: "",
    contactLabel: "Hubungi langsung",
    contactHref: "/contact",
    verified: false,
    coverUrl: "",
    coverThemeColor: "",
  },

  aboutHeading: "Tentang",
  aboutParagraphs: [
    "Storefront membantumu menemukan, melihat preview, dan membeli produk maupun layanan dari berbagai jenis bisnis — barang fisik, produk digital, jasa, hingga langganan. Mau yang gratis atau premium, jelajahi koleksi kami dan mulai dalam hitungan menit.",
    "Buat akun untuk menyimpan pembelian dan mengakses panel untuk mengelola kontenmu. Kami fokus pada kesederhanaan dan kualitas.",
  ],
  aboutAuthorHeading: "Tentang penulis",

  contactHeading: "Kontak",
  contactIntro: "Ada pertanyaan atau masukan? Isi form di bawah atau hubungi lewat media sosial.",
  supportContactHeading: "Kontak support",
  supportContactIntro: "Untuk pertanyaan produk, pembelian, atau dukungan teknis, hubungi kami:",

  licenseHeading: "Ketentuan & lisensi",
  licenseParagraphs: [
    "Produk yang dijual di sini bisa berupa barang fisik, produk digital, jasa, maupun langganan — tergantung bisnis penjualnya. Untuk produk digital, Anda membeli hak penggunaan, bukan lisensi eksklusif: boleh dipakai untuk proyek pribadi maupun komersial, sedangkan penggandaan atau redistribusi ke pihak ketiga tanpa izin tidak diperkenankan.",
    "Setiap produk kami periksa sebelum rilis. Kalau ada yang tidak sesuai, laporkan lewat halaman Kontak dan kami bantu selesaikan. Dukungan (support 1 bulan) berlaku untuk setiap pembelian berbayar, mencakup bantuan pemakaian dan perbaikan masalah.",
    "Pembayaran diproses dengan aman lewat payment gateway resmi kami (Duitku) langsung di halaman ini. Untuk sebagian produk pihak ketiga, pembayaran bisa diarahkan ke link resmi penjual—pastikan Anda selalu membeli dari sumber resmi.",
    "Dengan membeli atau mengambil produk gratis, Anda dianggap telah membaca dan menyetujui disclaimer serta ketentuan layanan kami.",
  ],

  howToHeading: "Cara pembelian",
  howToSteps: [
    { label: "Daftar akun", text: "Klik Daftar di pojok kanan atas, isi email dan password." },
    { label: "Lihat preview", text: "Klik tombol Lihat pada produk yang diminati untuk melihat detail lengkapnya." },
    { label: "Klik Beli", text: "Untuk produk berbayar, klik Beli. Anda akan diarahkan ke halaman pembayaran." },
    { label: "Lakukan pembayaran", text: "Selesaikan pembayaran sesuai instruksi di halaman tersebut." },
    { label: "Akses di Panel", text: "Setelah pembayaran terkonfirmasi, pembelian bisa diakses di Panel → Pembelian Saya." },
    { label: "Produk gratis", text: "Klik Ambil gratis. Langsung tersimpan di akun Anda tanpa biaya." },
  ],

  supportHeading: "Jaminan support 1 bulan",
  supportIntro:
    "Support 1 bulan diberikan untuk setiap pembelian berbayar. Dukungan teknis berlaku selama 1 bulan sejak tanggal pembelian. Yang termasuk:",
  supportPoints: [
    "Bantuan pemakaian (cara pesan, akses, dan pemakaian dasar)",
    "Perbaikan masalah pada produk yang Anda terima",
    "Panduan penyesuaian sederhana sesuai kebutuhan Anda",
  ],
  supportOutro:
    "Untuk memakai dukungan, sertakan detail pembelian (email atau bukti transaksi). Kami akan merespons dalam 1–2 hari kerja. Hubungi kami lewat",

  faqHeading: "FAQ",
  faqs: [
    {
      q: "Apa saja yang dijual di Storefront?",
      a: "Produk dan layanan dari berbagai jenis bisnis — barang fisik, produk digital, jasa, maupun langganan. Banyak di antaranya bisa di-preview gratis sebelum beli, lalu langsung dipakai sesuai kebutuhan.",
    },
    {
      q: "Bagaimana cara preview sebelum beli?",
      a: "Produk yang menyediakan preview punya tombol Lihat. Klik untuk membukanya di tab baru dan cek detailnya sebelum memutuskan membeli.",
    },
    {
      q: "Apakah produk bisa disesuaikan setelah dibeli?",
      a: "Tergantung produknya. Untuk produk digital yang berupa file, Anda mendapat akses penuh ke filenya dan bebas menyesuaikannya. Untuk produk atau layanan lain, penyesuaian mengikuti ketentuan penjual.",
    },
    {
      q: "Bagaimana support 1 bulan itu?",
      a: "Support 1 bulan diberikan untuk setiap pembelian berbayar. Anda punya hak support selama 1 bulan sejak pembelian: tanya seputar pemakaian, masalah pada produk, atau penyesuaian dasar. Hubungi kami lewat link Kontak dengan bukti pembelian.",
    },
  ],

  publisherTermsHeading: "Ketentuan publisher",
  publisherTerms: [
    "Nama lengkap yang Anda isi harus sama persis dengan nama pada KTP. Pengajuan dengan nama yang berbeda akan ditolak.",
    "Nama toko boleh berbeda dari nama asli. Nama toko inilah yang ditampilkan ke pembeli; nama asli dan data rekening hanya dilihat admin dan tidak pernah dipublikasikan.",
    "Anda menjamin memiliki hak penuh atas setiap produk yang Anda jual, termasuk seluruh gambar, teks, font, dan aset di dalamnya.",
    "Produk yang melanggar hak cipta, mengandung materi ilegal, atau menyesatkan pembeli akan dihapus dan status publisher dapat dicabut tanpa pemberitahuan.",
    "Rekening yang Anda daftarkan harus atas nama Anda sendiri. Pencairan hanya dikirim ke rekening tersebut.",
    "Deskripsi, harga, dan isi produk harus sesuai dengan yang diterima pembeli.",
  ],
};

/** Merge a partial/parsed value onto the defaults so missing keys never break render. */
export function normalizeContent(raw: unknown): SiteContent {
  if (!raw || typeof raw !== "object") return DEFAULT_CONTENT;
  const v = raw as Partial<SiteContent>;

  const strArr = (a: unknown, fallback: string[]) =>
    Array.isArray(a) && a.length > 0 ? a.map((x) => String(x ?? "")) : fallback;

  const steps =
    Array.isArray(v.howToSteps) && v.howToSteps.length > 0
      ? v.howToSteps.map((s) => ({ label: String(s?.label ?? ""), text: String(s?.text ?? "") }))
      : DEFAULT_CONTENT.howToSteps;

  const faqs =
    Array.isArray(v.faqs) && v.faqs.length > 0
      ? v.faqs.map((f) => ({ q: String(f?.q ?? ""), a: String(f?.a ?? "") }))
      : DEFAULT_CONTENT.faqs;

  const df = DEFAULT_CONTENT.founder;
  const rf = (v.founder ?? {}) as Partial<FounderCard>;
  const founder: FounderCard = {
    enabled: typeof rf.enabled === "boolean" ? rf.enabled : df.enabled,
    name: rf.name ?? df.name,
    role: rf.role ?? df.role,
    bio: rf.bio ?? df.bio,
    photoUrl: rf.photoUrl ?? df.photoUrl,
    contactLabel: rf.contactLabel ?? df.contactLabel,
    contactHref: rf.contactHref ?? df.contactHref,
    verified: typeof rf.verified === "boolean" ? rf.verified : df.verified,
    coverUrl: rf.coverUrl ?? df.coverUrl,
    // Validated, not trusted: this value is interpolated into a meta tag.
    coverThemeColor: /^#[0-9a-f]{6}$/i.test((rf.coverThemeColor ?? "").trim())
      ? (rf.coverThemeColor as string).trim().toLowerCase()
      : df.coverThemeColor,
  };

  return {
    footerTagline: v.footerTagline ?? DEFAULT_CONTENT.footerTagline,
    founder,
    aboutHeading: v.aboutHeading ?? DEFAULT_CONTENT.aboutHeading,
    aboutParagraphs: strArr(v.aboutParagraphs, DEFAULT_CONTENT.aboutParagraphs),
    aboutAuthorHeading: v.aboutAuthorHeading ?? DEFAULT_CONTENT.aboutAuthorHeading,
    contactHeading: v.contactHeading ?? DEFAULT_CONTENT.contactHeading,
    contactIntro: v.contactIntro ?? DEFAULT_CONTENT.contactIntro,
    supportContactHeading: v.supportContactHeading ?? DEFAULT_CONTENT.supportContactHeading,
    supportContactIntro: v.supportContactIntro ?? DEFAULT_CONTENT.supportContactIntro,
    licenseHeading: v.licenseHeading ?? DEFAULT_CONTENT.licenseHeading,
    licenseParagraphs: strArr(v.licenseParagraphs, DEFAULT_CONTENT.licenseParagraphs),
    howToHeading: v.howToHeading ?? DEFAULT_CONTENT.howToHeading,
    howToSteps: steps,
    supportHeading: v.supportHeading ?? DEFAULT_CONTENT.supportHeading,
    supportIntro: v.supportIntro ?? DEFAULT_CONTENT.supportIntro,
    supportPoints: strArr(v.supportPoints, DEFAULT_CONTENT.supportPoints),
    supportOutro: v.supportOutro ?? DEFAULT_CONTENT.supportOutro,
    faqHeading: v.faqHeading ?? DEFAULT_CONTENT.faqHeading,
    publisherTermsHeading: v.publisherTermsHeading ?? DEFAULT_CONTENT.publisherTermsHeading,
    publisherTerms: strArr(v.publisherTerms, DEFAULT_CONTENT.publisherTerms),
    faqs,
  };
}
