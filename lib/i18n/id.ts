/**
 * Indonesian strings, and for now the only locale.
 *
 * Flat keys with dots, not nested objects: a nested tree reads well until two
 * screens want the same word, and then it is either duplicated or reached for
 * through a path that describes where it was first used rather than what it
 * says. `common.*` holds the words that genuinely recur; everything else is
 * grouped by the surface it belongs to.
 *
 * The VALUES are the source of truth for what the site says. Adding English
 * later is a second file with the same keys and a locale switch in `t` — no
 * component changes, which is the whole point of moving them here.
 */
export const id = {
  /* ---- words that recur across surfaces ---- */
  "common.save": "Simpan",
  "common.saving": "Menyimpan…",
  "common.saved": "Tersimpan.",
  "common.cancel": "Batal",
  "common.delete": "Hapus",
  "common.add": "Tambah",
  "common.edit": "Edit",
  "common.back": "Kembali",
  "common.close": "Tutup",
  "common.search": "Cari",
  "common.loading": "Memuat…",
  "common.free": "Gratis",
  "common.price": "Harga",
  "common.category": "Kategori",
  "common.all": "Semua",
  "common.failed": "Gagal menyimpan.",
  "common.required": "Wajib diisi.",

  /* ---- site chrome ---- */
  "nav.home": "Beranda",
  "nav.categories": "Kategori",
  "nav.about": "Tentang",
  "nav.contact": "Kontak",
  "nav.privacy": "Privasi",
  "nav.terms": "Ketentuan",
  "nav.refund": "Pengembalian dana",
  "nav.signIn": "Masuk",
  "nav.profile": "Profil",
  "nav.panel": "Buka panel",
  "nav.myPurchases": "Pembelian saya",

  /* ---- homepage (link-in-bio) ---- */
  "home.searchPlaceholder": "Cari produk…",
  "home.searchLabel": "Cari produk",
  "home.searchOpen": "Cari produk",
  "home.searchClose": "Tutup pencarian",
  "home.searchClear": "Hapus pencarian",
  "home.searchNoMatch": "Tidak ada yang cocok.",
  "home.searchTryAgain": "Coba kata lain.",
  "home.empty": "Belum ada tautan di sini.",
  "home.filterLabel": "Filter kategori",
  "home.pagerLabel": "Halaman produk",
  "home.pagerPrev": "← Sebelumnya",
  "home.pagerNext": "Berikutnya →",
  "home.otherLinks": "Link lainnya",
  "home.otherLinksSub": "Situs lain milik kami.",
  "home.upcoming": "Segera",
  "home.freeRead": "Gratis · baca sekarang",
  "home.verified": "Terverifikasi",
  "home.themeToggle": "Ganti tema",

  /* ---- checkout ---- */
  "checkout.buyNow": "Beli sekarang",
  "checkout.getFree": "Ambil gratis",
  "checkout.preview": "Preview",

  /* ---- 404 ---- */
  "notFound.code": "404",
  "notFound.title": "Halaman tidak ditemukan",
  "notFound.body":
    "Alamatnya mungkin salah ketik, atau halamannya sudah dipindah. Tidak ada yang rusak di pihak Anda.",
  "notFound.home": "Ke beranda",
  "notFound.categories": "Lihat kategori",
  "notFound.contact": "Hubungi kami",

  /* ---- reader ---- */
  "reader.font": "Font",
  "reader.fontSmaller": "Perkecil font",
  "reader.fontBigger": "Perbesar font",
  "reader.margin": "Margin",
  "reader.marginLess": "Kurangi margin",
  "reader.marginMore": "Tambah margin",
  "reader.align": "Perataan",
  "reader.alignJustify": "Rata kanan-kiri",
  "reader.alignLeft": "Rata kiri",
  "reader.loadFailed": "Gagal memuat EPUB.",
  "reader.textFailed": "Gagal memuat teks.",
  "reader.actionsMenu": "Menu tindakan",
  "reader.share": "Bagikan",
  "reader.shareOther": "Bagikan lainnya…",
  "reader.signInGoogle": "Masuk dengan Google",
  "reader.copied": "Link disalin ke clipboard",

  /* ---- panel: shared shell ---- */
  "panel.publish": "Terbitkan",
  "panel.published": "Terbit",
  "panel.draft": "Draf",
  "panel.order": "Urutan",
  "panel.title": "Judul",
  "panel.url": "URL",
  "panel.deletePage": "Hapus halaman",
  "panel.viewPage": "Lihat halaman ↗",
  "panel.newPage": "+ Halaman",
  "panel.pageTitlePlaceholder": "Judul halaman",
  "panel.creating": "Membuat…",
  "panel.create": "Buat",
  "panel.noPages": "Belum ada halaman.",
  "panel.pagesIntro":
    "Halaman bebas dengan editor teks — \u201cTentang kami\u201d, \u201cCara kerja\u201d, apa pun. Yang sudah dipublikasikan muncul di footer.",
  "panel.linksHint":
    "Hanya link http:// atau https:// yang disimpan. Baris tanpa nama atau tanpa URL diabaikan.",
  "panel.socialHint":
    "Hanya http:// atau https:// yang disimpan. Field kosong = ikon jaringan itu tidak ditampilkan di situs.",
  "panel.addLink": "+ Tambah link",
  "panel.linkName": "Nama situs",
  "panel.linkNote": "Keterangan singkat (opsional)",
  "panel.moveUp": "Naikkan",
  "panel.moveDown": "Turunkan",
  "panel.removeLink": "Hapus link",
  "panel.tabSocial": "Media sosial",
  "panel.tabSocialSub": "Alamat tiap jaringan",
  "panel.tabOther": "Link lainnya",
  "panel.tabOtherSub": "Situs lain milik Anda",
} as const;

export type MessageKey = keyof typeof id;
