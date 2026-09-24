# Template `blog` — URL persis Blogger, plus importer

Storefront yang isinya **tulisan**, bukan katalog. Dibuat untuk memindahkan blog
Blogger/Blogspot ke sini **tanpa kehilangan satu alamat pun**: sepuluh tahun
backlink, hasil pencarian, dan bookmark orang lain menunjuk ke string-string di
bawah, dan skema URL yang "mirip" adalah skema URL yang 404.

## Alamat yang dijawab

| Alamat | Rute | Isi |
|---|---|---|
| `/` | `app/page.tsx` → `BlogHome` | daftar tulisan terbaru + sidebar |
| `/2026/09/judul-tulisan.html` | `app/[year]/[month]/[post]/` | satu tulisan |
| `/p/judul-halaman.html` | `app/p/[slug]/` (cabang kedua) | halaman |
| `/2026/09/` | `app/[year]/[month]/` | arsip bulan |
| `/search/label/Nama%20Label` | `app/search/label/[label]/` | tulisan berlabel |
| `/search?q=kata` | `app/search/` | pencarian |
| `/feeds/posts/default` (+`?alt=rss`), `/rss.xml`, `/atom.xml` | `lib/blog-feed-route.ts` | feed |
| `/sitemap.xml` | `app/sitemap.ts` | ikut memuat semua tulisan |

**Yang belum ada:** arsip per-TAHUN (`/2026/`). Data dan query-nya sudah
(`getBlogArchive(year, null)`), rutenya belum — satu segmen dinamis di root
adalah rute paling luas yang bisa ditambahkan ke aplikasi ini dan belum
dibutuhkan; sidebar hanya menaut ke bulan.

## Tiga hal yang mudah dirusak

**1. `path` DISIMPAN, tidak dihitung.** Blogger membangun
`/2026/09/judul.html` dari bulan tulisan itu **pertama** terbit lalu mengunci
hasilnya, dan memotong slug ~40 karakter dengan aturan yang tidak pernah
didokumentasikan. Menghitung ulang dari judul + tanggal akan memindahkan
sebagian tulisan ke alamat yang tidak pernah ada. Karena itu `path` adalah kolom
(`lp_blog_posts.path`, unik per situs) dan importer menyalinnya apa adanya.
`lib/blog-path.ts` `buildPostPath()` hanya untuk tulisan yang lahir di sini.

**2. `.html` adalah pembeda, bukan ekstensi berkas.** `/p/about` adalah halaman
editorial (`lp_pages`), `/p/about.html` adalah halaman blog hasil impor. Satu
rute melayani keduanya: `lp_pages` dulu (halaman yang ditulis di panel memiliki
slug-nya; impor tidak boleh mengambilnya), lalu tabel blog.
`stripHtmlSuffix()` mengembalikan `null` — bukan slug — kalau akhirannya tidak
ada, dan itulah yang membuat keduanya tidak bisa saling menutupi.

**3. `lib/missing-record.ts` ikut memutuskan.** Proxy menjawab 404 **sungguhan**
untuk record yang tidak ada, dan ia berjalan **sebelum** rute. Waktu tabel blog
ditambahkan, setiap halaman `/p/*.html` 404 di proxy meski datanya ada — halaman
itu ada, requestnya tidak pernah sampai. Sekarang guard itu memakai
`stripHtmlSuffix()` yang sama dan menanyakan tabel yang benar. **Rute blog baru
apa pun harus dipertimbangkan di file itu juga**, atau ia akan bekerja sempurna
dan tidak pernah dipanggil.

## Impor dari Blogger

Masukannya adalah SQLite hasil `blogger_to_sqlite.py`, bukan arsip Takeout-nya.

```bash
# pertama kali (membuat baris lp_sites sekalian)
node --env-file-if-exists=.env.local --env-file-if-exists=.env.development.local \
  scripts/import-blogger.mjs blog.db --site techgalery.com --create-site \
  --media /path/takeout-…zip

# lihat dulu tanpa menulis apa pun
node scripts/import-blogger.mjs blog.db --site techgalery.com --dry-run
```

- **Idempoten.** Semua dicocokkan lewat `source_id` (id Blogger), jadi
  menjalankannya dua kali memperbarui, bukan menggandakan.
- **Tidak pernah menghapus.** Tulisan yang hilang di Blogger tetap di sini
  sampai seseorang memutuskan sebaliknya.
- **`--media`** menerima zip Takeout **atau** direktori album yang sudah
  dibuka. Zip dibaca langsung (`openZip` di importer, `zlib.inflateRawSync`) —
  `unzip` tidak ada di mesin ini dan menambah dependency untuk skrip yang tidak
  pernah dijalankan aplikasi adalah pertukaran yang salah.
- Gambar disalin ke bucket publik `landing-assets` di bawah
  `blog/<site_id>/<hash-url>-<namafile>`, lalu HTML tulisannya ditulis ulang.
  Nama berkas memakai hash URL sumbernya karena satu arsip bisa punya tiga
  `youcam-makeup-try-on.jpg` yang berbeda.
- **Semua varian ukuran ikut ditulis ulang.** Blogger menyajikan satu unggahan
  di banyak ukuran dan menaruh ukurannya di path (`/s640/`, `/s1600/`);
  `post_images` hanya menangkap `<img src>`, jadi mengganti string itu saja
  membuat gambarnya lokal sementara `<a href>` pembungkusnya tetap ke Google.
  `sameImagePattern()` yang menutup itu.

### Hasil impor 2026-09-24 (techgalery.com)

| | |
|---|---|
| tulisan | 416 (410 terbit + 1 draft + 5 halaman) |
| label | 65, 429 kaitan |
| komentar | 96 — **0 LIVE**, 88 spam, 8 menunggu moderasi |
| gambar | 572 disalin, 398 tulisan HTML-nya ditulis ulang, **23 tulisan** masih menunjuk googleusercontent |

Dua catatan yang bukan bug:

- **Bagian komentar tidak muncul sama sekali**, karena tidak ada satu pun
  komentar berstatus LIVE di ekspor — semuanya spam atau menunggu moderasi.
  Datanya tetap disimpan beserta statusnya.
- **23 tulisan masih memuat URL googleusercontent**, karena arsip Takeout yang
  tersedia di mesin ini (Nov 2025) lebih tua dari ekspor blog-nya (Sep 2026):
  gambar yang diunggah di antara dua tanggal itu tidak ada berkasnya. Jalankan
  lagi dengan Takeout yang baru untuk menutup sisanya — importer-nya idempoten.

## Yang tidak dilakukan

- **Tidak ada editor tulisan di panel.** Satu-satunya jalur tulis adalah
  importer, yang tersambung sebagai service role. `lib/actions/blog.ts` sengaja
  tidak punya mutasi sama sekali — pintu yang terbuka untuk layar yang belum ada
  adalah pintu yang terbuka.
- **Komentar baru tidak diterima** (keputusan 2026-09-24). Tidak ada policy
  insert untuk siapa pun kecuali service role.
- **`<iframe>` dibuang** oleh `sanitizePageHtml`, yang juga membuang `<script>`
  dari 36 tulisan (AdSense/analytics lama) dan mempertahankan tabel di 281
  tulisan. Biayanya satu embed YouTube di seluruh arsip.
- HTML **disanitasi saat render**, bukan saat impor: sumbernya disimpan apa
  adanya, dan perbaikan pada sanitizer berlaku surut untuk semua tulisan.
