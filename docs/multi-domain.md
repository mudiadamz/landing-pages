# Multi-domain (beberapa storefront, satu sistem)

Satu deployment Vercel melayani banyak domain. Tiap domain punya nama, tagline,
deskripsi SEO, **template tampilan**, **palet warna**, tracking, hero, popup, dan
custom JS sendiri — tapi **katalog produknya satu**. Domain memilih *kategori*, bukan produk, jadi tidak ada produk yang
diduplikasi dan satu produk bisa tampil di beberapa storefront.

Dikelola di **dua layar**, dan pembagiannya disengaja:

| Layar | Isi | Kenapa dipisah |
|---|---|---|
| **`/panel/sites`** (Situs → Domain) | hostname, aktif/nonaktif, status Vercel, panduan DNS & Supabase, tambah/hapus domain | Mengubah host butuh DNS, domain di Vercel, dan redirect URL di Supabase. Salah satu huruf dan storefront-nya tidak bisa diakses — atau diam-diam menampilkan situs utama selamanya. |
| **`/panel/branding`** (Situs → Identitas situs) | nama, tagline, deskripsi SEO, logo, ikon, template, palet, niche | Semuanya copy & styling: bisa dibalik, sering diubah, tanpa menyentuh dashboard pihak ketiga. |

Dulu satu form. Akibatnya: mengganti logo berarti mengirim ulang field host, dan layar
yang dibuka untuk memperbaiki tagline terlihat sama seperti layar yang bisa mematikan
domain. Sekarang dua `SiteInput` terpisah dengan dua server action —
`updateSiteDomain` tidak pernah menyentuh nama/logo, `updateSiteProfile` tidak pernah
menyentuh `host`/`active`.

### Satu switcher untuk seluruh panel

Domain yang sedang dikelola dipilih **sekali**, di **sidebar** (“Situs yang
dikelola”), dan berlaku untuk seluruh panel:

| Layar | Cara di-scope |
|---|---|
| Identitas situs, Hero, Konten situs, Tracking, Popup, Custom JS | baris/`lp_site_settings` milik situs itu |
| **Produk digital** | **kategori** — niche situs diperluas ke sub-kategorinya (produk milik kategori, bukan milik situs) |
| **Penjualan, Analytics, Kontak** | kolom `site_id` di `lp_purchases` / `lp_sessions` / `lp_page_events` / `lp_contacts` |

**Sengaja TIDAK di-scope**, karena konsepnya tidak ada: Users & Roles (satu
`auth.users` dipakai semua domain), Kategori (memang dibagi — itu justru mekanisme
niche-nya), Storage & Assets (satu bucket), Tampilan (palet panel, admin-global),
Email masuk (satu alamat inbound), dan Domain (daftar situsnya sendiri).

Dulu tiap layar punya `SiteSwitcher`-nya sendiri lewat `?site=<id>`. Dua masalah:
enam kontrol untuk satu keputusan, dan pilihannya **hilang begitu pindah halaman** —
pilih domain niche di Hero, klik Popup, dan diam-diam kembali ke domain utama.

Sekarang pilihannya ada di cookie `panel_site` (`lib/panel-site.ts`, httpOnly, path
`/panel`, umur 1 tahun) dan dibaca oleh `editingSite()`. Yang perlu diketahui:

- **Nilainya tidak pernah dipercaya.** `editingSite()` mencocokkannya ke `lp_sites`
  dan jatuh ke domain utama kalau tidak ketemu, jadi cookie basi (domain yang sudah
  dihapus) atau hasil edit tangan tidak bisa menulis setting untuk situs yang tidak
  ada. `selectPanelSite()` juga menolak id yang tidak dikenal sebelum menyimpannya.
- **Cookie ini tidak memberi izin apa pun** — cuma memilih scope. Semua penulisan
  tetap lewat `requireAdmin()`/`requireFeature()`.
- **Tiap layar per-domain tetap menyebutkan situsnya** (`SiteScopeNotice`) — itu
  risiko utama scope global: mengedit hero domain yang salah tanpa sadar. Enam
  pengingat read-only, satu kontrol.
- **Link lintas-layar harus men-set scope, bukan mengirim param.** Tombol
  “Identitas & tampilan →” di `/panel/sites` memanggil `selectPanelSite()` lalu
  navigasi; `<Link href=”…?site=…”>` akan mendarat di situs yang ditunjuk sidebar,
  bukan baris yang diklik.
- `listSites()` dibungkus `cache()` React (memoisasi **per request**, bukan lintas
  request — admin tetap melihat tulisannya sendiri): layout + halaman + `editingSite()`
  tadinya menghasilkan empat query identik per navigasi panel.

Panduan langkah Vercel & Supabase dengan nilai yang sudah terisi ada di tiap baris
domain di `/panel/sites` — dokumen ini versi lengkapnya.

## Konsep

| | |
|---|---|
| **Tabel** | `lp_sites` — `host`, `name`, `tagline`, `description`, `category_ids`, `template`, `palette`, `logo_url`, `icon_url`, `is_canonical`, `active` |
| **Domain utama** | `is_canonical = true`. Satu-satunya. Memegang `/panel`, callback Duitku, dan jadi fallback untuk host yang tidak dikenal (preview deployment, `*.vercel.app`, domain yang diarahkan sebelum didaftarkan). |
| **Niche** | `category_ids` berisi kategori **induk**; sub-kategorinya ikut otomatis. **Kosong = seluruh katalog** — itu yang dipakai domain utama, bukan berarti "tidak tampilkan apa-apa". |
| **Pengaturan** | `lp_site_settings` di-key `(site_id, key)`. Per-domain: `hero`, `site_content`, `tracking`, `promo_popup`, `custom_js`. Global (pinned ke domain utama): `panel_palette`, `role_permissions`. |
| **Template** | `lp_sites.template` — frontend storefront: halaman depan, **header/menu, footer**, halaman kategori, dan daftar kategori. Teks bebas divalidasi terhadap `lib/templates/registry.tsx`, **bukan** enum DB, jadi menambah template tidak butuh migration; key tak dikenal jatuh ke `default`. Tiga tema sekarang: `default` (Marketplace), `pustaka` (rak buku), `linkbio` (Linktree). Slot kategori **opsional** — yang kosong jatuh ke versi Marketplace, termasuk chrome-nya. Detail: README → "Template tampilan". |
| **Palet** | `lp_sites.palette` — kunci preset dari `lib/palette.ts` (bukan hex), diinjeksi sebagai `<style>` di body `app/layout.tsx`. Menimpa 4 token mood; latar/teks/border tetap. |
| **Logo & ikon** | `lp_sites.logo_url` (wordmark lebar, untuk header) dan `lp_sites.icon_url` (persegi: favicon, PWA, apple-touch, avatar Link in bio). Keduanya URL publik di bucket `landing-assets` prefix `sites/`. NULL = lambang ADM.UIUX. Detail: bagian "Logo & ikon" di bawah. |
| **Nonaktif** | `active = false` → domain itu menampilkan situs utama, bukan halaman error. |

### Atribusi per-domain (`site_id`) dan lubang historisnya

`lp_sessions`, `lp_page_events`, `lp_purchases`, `lp_contacts`, `lp_reviews` punya
`site_id` (migration `20260808050000`). Sebelum itu **tidak ada** yang mencatat
storefront mana — `referrer_host` itu asal *pengunjung* (instagram.com), bukan domain
kita — jadi panel tidak bisa menjawab “bagaimana performa resepku.com bulan ini”.

Diisi saat menulis dari host request, **kecuali pembayaran**: callback Duitku datang
server-to-server ke domain **utama**, jadi tidak bisa tahu pembeli ada di mana. Situs
ikut lewat `additionalParam` bersama `lp`/`u`/`e`. Field itu dibatasi 255 karakter dan
string yang terpotong **bukan JSON valid** — callback akan gagal parse, jatuh ke
`merchantOrderId`, dan kehilangan email **dan** situs. Karena itu field-nya sekarang
dibuang berurutan dari yang paling tidak penting sampai muat, bukan di-`slice` buta.

> **Data lama tidak bisa diatribusikan ke belakang.** Informasinya memang tidak pernah
> dicatat, jadi semua baris lama `NULL`. Panel membaca `NULL` sebagai **domain utama** —
> itu memang asalnya, karena selama periode itu deployment ini cuma melayani satu
> domain. Konsekuensinya: **domain niche mulai dari nol**, dan layar penjualan yang
> kosong itu terlihat persis seperti query yang rusak. `SiteScopeCoverage` menyebutkan
> yang mana di setiap layar ber-angka — jangan hapus komponen itu.

`ON DELETE SET NULL`, bukan `CASCADE`: menghapus domain tidak boleh menghapus
pembelian, review, atau riwayat penjualannya. Barisnya kehilangan atribusi, titik.
(`lp_site_settings` memang `CASCADE` — hero tanpa domainnya tidak berarti apa-apa.
Pembayaran beda.)

`lp_track_session` dapat parameter `p_site_id` **dengan DEFAULT**: deploy tidak atomik
dengan migration, dan route tracking menelan error-nya sendiri, jadi tanpa default
setiap penulisan sesi di antara keduanya akan gagal tanpa suara.

## Menambah domain

Tiga tempat. Melewatkan satu menghasilkan gejala yang terlihat seperti bug.

### 1. Panel — `/panel/sites` → **Tambah domain**

Form ini cuma minta dua hal, lalu melempar Anda ke `/panel/branding` untuk sisanya.
Domain baru belum bisa diakses sampai DNS propagasi, jadi tidak ada gunanya menuntut
palet lebih dulu.

- **Domain** — hostname saja: `resepku.com`. Tanpa `https://`, tanpa garis miring.
  Boleh subdomain. Form membersihkan input yang salah bentuk, tapi nilai yang
  tersimpan harus sama persis dengan header `Host`, kalau tidak domain itu akan
  selamanya menampilkan situs utama — dan itu membingungkan untuk dilacak.
- **Nama situs** — dipakai di judul tab, `og:site_name`, dan JSON-LD. Bisa diubah nanti.

Sisanya di **`/panel/branding`** (Situs → Identitas situs), tiga blok:

- **Identitas** — nama, **tagline** (headline pendek; masuk ke judul `Nama — tagline`),
  **deskripsi SEO** (snippet Google, 120–160 karakter — beda pekerjaan dari tagline,
  jangan disamakan), **logo & ikon**.
- **Tampilan** — template dan palet.
- **Katalog (niche)** — centang kategori induk. Kosong = seluruh katalog.

### 2. Vercel — supaya domainnya sampai ke aplikasi

**Bisa otomatis.** Kalau `VERCEL_API_TOKEN` diset, panel menambahkan domain ke
project sendiri lewat REST API Vercel (`POST /v10/projects/{id}/domains`) begitu
domain dibuat. Kartu domain di `/panel/sites` menampilkan statusnya —
*Aktif di Vercel* / *Menunggu DNS* / *Belum di Vercel* — plus tombol
**Tambah ke Vercel** dan **Cek verifikasi**, dan record DNS yang diminta Vercel
kalau domainnya butuh diverifikasi.

Env yang dibutuhkan (lihat `.env.example`):

```
VERCEL_API_TOKEN=      # Vercel → Account Settings → Tokens
VERCEL_PROJECT_ID=     # dari .vercel/project.json (projectId)
VERCEL_TEAM_ID=        # dari .vercel/project.json (orgId)
```

> **Token Vercel itu luas.** Scope-nya per akun/team, bukan per endpoint — tidak
> ada token "domains saja", jadi token ini bisa melakukan apa pun yang team bisa
> (termasuk menghapus project). Simpan sebagai env server (**jangan** pakai
> prefix `NEXT_PUBLIC_`), batasi ke team, dan beri masa kedaluwarsa. Semua
> pemakaiannya ada di `lib/vercel-domains.ts` dan setiap pemanggil lewat
> `requireAdmin()`.

Tanpa token, langkahnya manual dan panduan di panel tetap menampilkan nilai yang
perlu dipasang. **Menghapus domain di panel tidak melepasnya dari Vercel** —
disengaja, supaya tidak mematikan domain hidup hanya karena mau di-repoint.

Kalau manual: Project **`landing_pages`** → Settings → Domains → **Add**.

- **Subdomain `admuiux.com`** (mis. `resep.admuiux.com`) — DNS-nya sudah di Vercel,
  jadi langsung jalan. Tidak perlu beli domain, SSL otomatis.
- **Domain terpisah** — Vercel menampilkan record DNS yang harus dipasang di
  registrar (nameserver atau A/CNAME). **Ikuti yang Vercel tampilkan**, jangan
  nilai dari catatan lama — nilainya bisa berubah. SSL otomatis setelah verifikasi.

Batas domain per project: Hobby 50, Pro *soft limit* 100.000. Tidak akan kena.

### 3. Supabase — **tidak ada yang perlu diubah**

Login Google di domain baru jalan tanpa menyentuh dashboard. Bagian ini menjelaskan
kenapa, karena dulu tidak begitu dan kesalahannya sulit dikenali.

**Dulu:** tiap domain harus didaftarkan sendiri di Authentication → URL Configuration
→ Redirect URLs. Kalau lupa, tidak ada error. `redirect_to` yang tidak terdaftar
bukan ditolak oleh Supabase — dibuang diam-diam dan diganti **Site URL** project.
Jadi "Masuk dengan Google" tetap berhasil, tapi pengunjungnya mendarat di
`admuiux.com` berikut cookie sesinya, dan di domain yang dia mulai tadi dia tetap
terlihat belum masuk. Pembeli yang login di tengah checkout terlempar keluar dari
produk yang sedang dibeli.

**Sekarang:** OAuth selalu kembali ke satu URL yang pasti terdaftar — callback
domain kanonik — lalu callback itu **melempar balik** ke domain asal.

```
domaintest.fit  →  Google  →  admuiux.com/auth/callback?sf=domaintest.fit
                                        ↓ (tidak menukar code di sini)
                              domaintest.fit/auth/callback?code=…
                                        ↓ exchangeCodeForSession
                              cookie sesi terpasang di domaintest.fit
```

Yang berpindah adalah **`code`-nya, bukan sesinya**. Domain kanonik sengaja tidak
menukar code itu sendiri: `signInWithOAuth` menulis verifier PKCE sebagai cookie di
domain yang tombolnya ditekan, dan cookie tidak lintas host — `admuiux.com` tidak
bisa membacanya. Justru karena code itu tak berguna di tempat lain, mengopernya lewat
jalan memutar ini aman. Detail dan penjagaannya ada di `lib/oauth-return.ts`;
`?sf=` divalidasi terhadap `lp_sites`, tanpa itu callback kanonik jadi open redirect
yang menyerahkan code pengunjung ke domain siapa pun.

**Yang masih wajib ada di daftar** cuma satu baris, dan sudah terpasang:

```
https://admuiux.com/auth/callback
```

Kalau baris itu hilang, login patah di **semua** domain sekaligus. Cara mengeceknya
tanpa membuka dashboard — minta GoTrue memvalidasi alamatnya lewat token yang pasti
ditolak, lalu lihat ke mana dia melempar:

```bash
curl -s -o /dev/null -w '%{redirect_url}\n' \
  "https://uxizlsoggphacyvtshub.supabase.co/auth/v1/verify?token=x&type=signup&redirect_to=https%3A%2F%2Fadmuiux.com%2Fauth%2Fcallback"
```

Balasannya memuat `/auth/callback` → terdaftar. Balasannya `admuiux.com/` telanjang →
sudah tidak, dan login patah di mana-mana.

**Localhost dan preview `*.vercel.app`** tidak lewat jalan memutar ini: pelemparnya
hanya mau mengirim ke host yang ada di `lp_sites`, jadi host asing malah akan
tersangkut di domain kanonik. Keduanya tetap callback ke dirinya sendiri dan tetap
butuh baris sendiri di daftar — untuk `http://localhost:3000/auth/callback` sudah ada.

### 4. Google Cloud Console — **biasanya tidak perlu diubah**

Login Google lewat Supabase memakai callback **milik Supabase**, bukan domain kita.
Jadi *Authorized redirect URIs* di Google tetap satu nilai untuk semua domain:

```
https://uxizlsoggphacyvtshub.supabase.co/auth/v1/callback
```

Sudah terpasang sejak awal, jadi **domain baru tidak menambah pekerjaan di sini**.
Tambahkan `https://<domain>` ke *Authorized JavaScript origins* hanya kalau nanti
memakai Google One Tap — sekarang tidak dipakai.

### 5. Cek

- Homepage tampil dengan produk niche yang dipilih.
- `/panel` memantul ke homepage (panel hanya di domain utama).
- Masuk dengan Google berhasil **dan tetap di domain itu**.

## Logo & ikon

Dua upload di `/panel/branding`, bukan satu, karena bentuk dan tugasnya berbeda:

| | Logo | Ikon |
|---|---|---|
| Bentuk | lebar / wordmark | **persegi**, min. 192×192 |
| Format | PNG · WebP · JPEG · SVG | PNG · WebP · SVG (**tanpa JPEG**) |
| Maks | 300 KB | 200 KB |
| Dipakai di | header semua template, JSON-LD `logo` | tab browser, PWA/install, apple-touch, splash iOS, kartu OG, avatar Link in bio |

Kalau satu kolom dipakai untuk keduanya, hasilnya: wordmark terpotong di tab browser,
atau lambang seukuran stempel di header. JPEG ditolak untuk ikon karena tidak punya
transparansi — hasilnya kotak putih di tab gelap dan di launcher Android.

**Header punya tiga keadaan** (`components/site-logo.tsx`):

1. logo terpasang → gambarnya saja, tanpa nama di sebelahnya (wordmark sudah memuat nama)
2. hanya ikon → lambang persegi + nama situs sebagai teks
3. keduanya kosong → lambang ADM.UIUX + nama situs

**Validasi di server, dari magic bytes, bukan dari MIME yang dikirim browser**
(`lib/site-brand.ts`). Tipe hasil sniffing itulah yang dipakai sebagai
`Content-Type` saat disimpan, jadi PNG yang di-rename `.svg` tersimpan sebagai PNG
dan HTML yang di-rename `.png` ditolak. Ikon raster diukur (PNG lewat IHDR, WebP
lewat header RIFF) dan harus persegi — banner 400×100 ditolak dengan pesan yang
menyuruh pakai kolom Logo.

**Favicon harus lewat `generateMetadata`, tidak bisa lewat file.** `app/icon.svg`
dan `app/favicon.ico` **dipindah ke `public/`** justru karena itu: nama file di
`app/` adalah konvensi build-time, Next memancarkan tag `<link>`-nya untuk semua
response, dan aset build-time tidak bisa berbeda per host. Selama file itu ada di
`app/`, domain niche akan memakai lambang ADM.UIUX di tab-nya apa pun isi kolom
`icon_url`. Di `public/` keduanya jadi file statis biasa dan dipakai sebagai
fallback — `/favicon.ico` tetap terlayani untuk browser yang memintanya tanpa
diberi tahu.

`app/manifest.ts` juga per-domain sekarang (nama, deskripsi, ikon), yang membuat
route-nya dinamis — satu JSON kecil per prompt install, bukan per pageview. Ikonnya
dideklarasikan `sizes: "any"`: upload sudah dipastikan persegi tapi ukuran pikselnya
tidak dicatat, jadi `"512x512"` akan jadi klaim palsu. Chrome menerima `"any"` untuk
installability, sama seperti untuk ikon SVG.

**Ikon baru tidak langsung terlihat di tab.** Browser meng-cache favicon lebih
agresif daripada halaman; hard reload atau tab baru.

## PWA: ikon, warna, dan splash screen

Yang dibaca **OS**, bukan browser — dan karena itu tidak bisa ikut CSS. Manifest
`background_color`, `theme-color`, ikon home-screen, dan launch image iOS semuanya
dipakai *sebelum* satu byte CSS ada, jadi nilainya harus dikirim terpisah. Satu
sumber: **`lib/site-appearance.ts`** (`siteAppearance(site, template)`), dipakai
empat permukaan — `app/manifest.ts`, `app/layout.tsx`, `/api/splash`,
`/api/site-icon`.

| Permukaan | Dari mana | Catatan |
|---|---|---|
| `theme_color` / `background_color` | `template.surfaces.background` | Dulu `#fdfcfb` mati — di template hangat (linkbio, mbahgpt) install-nya berkedip putih dulu |
| `<meta name="theme-color">` | sama | Cover color halaman depan tetap menang (`data-locked`) |
| Ikon tab | `lp_sites.icon_url` apa adanya | File asli, tanpa diproses |
| `apple-touch-icon` | **`/api/site-icon/apple-180.png`** | iOS tidak menerima SVG dan merender PNG transparan di atas hitam |
| Manifest `maskable` | **`/api/site-icon/maskable-{192,512}.png`** | Launcher Android memotong jadi lingkaran; mark digambar 60% biar sudutnya selamat |
| Launch image iOS | **`/api/splash/{w}x{h}-{light,dark}.png`** | 17 ukuran layar × 2 skema |

**Splash-nya dirender per request, bukan file.** Dulu 34 PNG di `public/splash`
yang di-generate dari `public/icon-512.png` — aset build-time, dan aset build-time
tidak bisa berbeda per host (alasan yang sama persis dengan `app/icon.svg` di atas),
jadi tiap domain niche booting dengan lambang ADM.UIUX di atas warna ADM.UIUX.
`scripts/gen-ios-splash.mjs` dan `npm run gen:splash` ikut dihapus.

Dua hal yang menjaga route itu tetap murah dan aman:

- **URL-nya bawa `?v=`**, sidik jari dari nama+ikon+warna. Isinya `immutable` satu
  tahun di CDN, tapi berubah URL begitu situsnya ganti identitas.
- **Ukurannya allow-list** (`parseSplashSpec`, `parseIconSpec`). Route yang mau
  menggambar ukuran apa pun dari URL itu generator gambar terbuka — satu request
  20000×20000 sudah cukup untuk menghabiskan memori server, dan tidak perlu login.

**Ikon WebP tidak muncul di splash.** `next/og` merender lewat satori → resvg, yang
bisa PNG, JPEG, dan SVG — bukan WebP. Ikon WebP tetap benar di tab browser dan di
manifest; di splash & ikon home-screen ia jatuh ke **inisial situs** di atas warna
situs (`brandInitials()`, sama seperti avatar Link in bio). Salah lambang, tapi
masih storefront yang benar — lebih baik daripada kotak kosong. Pakai PNG atau SVG
kalau ingin lambangnya ikut.

**Kartu OG juga per-domain sekarang** (`app/opengraph-image.tsx`): nama situs,
tagline, deskripsi, ikon, dan garis atas dari `primary` palet domain itu — di atas
warna halaman template-nya. Sebelumnya satu gambar dengan teks "ADM.UIUX" dan
"admuiux.com" yang di-bake, jadi link ke storefront niche tampil sebagai merek
orang lain di WhatsApp.

## Siapa boleh mengurus domain ini

Sejak `lp_site_members` ada, "admin" bukan satu tingkat lagi. Tiga istilah,
dijelaskan lengkap di [`plans/hierarchical-users.md`](plans/hierarchical-users.md):

- **Company** (`lp_profiles.role = 'admin'`) melihat semua domain dan
  satu-satunya yang boleh menambah/menghapus domain, mengangkat Company lain,
  dan menghapus akun.
- **Agent** (`lp_site_members.role = 'admin'`) mengurus konten, setelan, dan
  anggota **domain itu saja**. Filter situs di tiap layar per-domain hanya
  memuat domain yang jadi keanggotaannya, dan cookie `panel_site` dicocokkan
  dengan daftar itu — mengganti nilainya di devtools tidak membuka domain orang
  lain. Agent satu domain tidak melihat filternya sama sekali: tidak ada yang
  bisa dipilih.
- **Customer** (`lp_site_members.role = 'customer'`) pembeli di domain itu.

Konsekuensi yang mudah terlewat: **panel tetap hanya dilayani domain kanonik**,
jadi Agent sebuah domain niche pun login di sana. Sesi Supabase tidak lintas
domain, dan itu tidak berubah.

Detail, fase, dan keputusan yang masih terbuka ada di
[`plans/hierarchical-users.md`](plans/hierarchical-users.md).

## Yang perlu diketahui

**Login tidak lintas domain, dan itu disengaja.** Cookie sesi Supabase terikat per
domain. Pengunjung login sendiri di tiap domain. Karena akunnya tetap satu
`auth.users` (email yang sama), pembelian dari beberapa domain tetap muncul
bersama di "Pembelian saya".

**`/panel` itu area campuran, bukan area admin.** Pembeli membaca "Pembelian
saya", invoice, dan favorit di situ. Karena sesi tidak lintas domain, sesi pembeli
cuma ada di domain tempat dia beli — jadi **route pembeli harus jalan di semua
domain**, kalau tidak pembeli terjebak: pembeliannya tidak bisa dibuka di
storefront yang dia pakai, dan di domain utama dia belum login.

Yang canonical-only hanya layar **admin**, supaya admin tidak login ulang di tiap
storefront. Dijaga di `app/panel/layout.tsx` dengan **allowlist** route pembeli
(`CUSTOMER_PANEL_PATHS`) — bukan blocklist route admin, supaya layar admin baru
otomatis ikut terkunci. Route admin yang dibuka dari domain niche di-redirect ke
**path yang sama di domain utama**, tempat sesinya sudah ada.

Layout tidak menerima pathname, jadi middleware (`lib/supabase/proxy.ts`)
meneruskannya lewat header `x-pathname`.

**Pembayaran tidak butuh setelan per domain.** `callbackUrl` Duitku selalu ke
domain utama (server-to-server, jadi harus satu host tetap — kalau ikut domain
pembeli, tiap domain baru otomatis jadi endpoint pembayaran). `returnUrl` ikut
domain tempat pembeli belanja.

**Menghapus domain menghapus pengaturannya** (cascade: hero, popup, tracking,
custom JS). Produk tidak terpengaruh — produk milik kategori, bukan milik domain.
Domain utama tidak bisa dihapus.

**Cache 60 detik, dan jebakan invalidasinya.** `lp_sites` dibaca lewat
`unstable_cache` dengan `revalidate: 60`.

Awalnya 300 detik dengan invalidasi lewat `updateTag("sites")` saja — dan itu
**tidak bekerja**: `updateTag` hanya mengenali fetch tags dan `cacheTag()` di dalam
`'use cache'`, bukan opsi `{ tags: [...] }` pada `unstable_cache`. Terukur:
setelah simpan di panel, baris database **dan** panel menampilkan nilai baru
sementara halaman publik tetap menyajikan yang lama sampai ada deploy baru.

Sekarang `bustSiteCaches()` memanggil `revalidateTag(tag, "max")` (profil wajib di
Next 16.1.6) **dan** `updateTag(tag)`, dan TTL diturunkan ke 60 detik sebagai jaring
pengaman. Perubahan langsung di database (tanpa invalidasi apa pun) terlihat dalam
~20 detik.

> Call site `updateTag` lain — `categories`, `hero`, `site_content`, `tracking`,
> `promo_popup`, `homepage-pages` — kemungkinan lag dengan cara yang sama. Belum
> diverifikasi satu per satu.

## Catatan implementasi

Kalau menambah pengaturan per-domain baru, ikuti pola yang ada — ada satu jebakan
yang bikin semuanya rusak secara halus:

> **`unstable_cache` tidak bisa membaca `headers()`.** Sama seperti `cookies()`,
> dia menolak dynamic data source. Jadi host di-resolve **di luar** cache lalu
> `siteId` dikirim **sebagai argumen** — dan argumen itulah yang membuat cache
> key beda per domain. Kalau `siteId` dicari di dalam fungsi yang di-cache, satu
> storefront akan menyajikan hero dan daftar produk milik storefront lain dari
> entry cache yang sama.

Pola pembacanya (`lib/actions/site-settings.ts`):

```ts
const readHero = unstable_cache(
  async (siteId: string) => { /* .eq("site_id", siteId) */ },
  ["hero-config"],
  { revalidate: 120, tags: ["hero-config"] },
);
export async function getHero(siteId?: string) {
  return readHero(siteId ?? (await currentSiteId()));
}
```

Penulisnya wajib `onConflict: "site_id,key"` — primary key-nya komposit, jadi
`onConflict: "key"` akan gagal.

Resolver ada di `lib/site-resolve.ts`: `currentSite()`, `currentSiteId()`,
`currentOrigin()`, `canonicalOrigin()`, `isCanonicalRequest()`, dan
`editingSite(param)` untuk layar panel (dari `?site=<id>`, divalidasi ke tabel).

Pembacaan `lp_sites` **melempar** error database dan hanya mengembalikan `null`
untuk host yang benar-benar tidak ada. Itu disengaja: `unstable_cache` menyimpan
nilai yang dikembalikan, jadi `null` hasil error yang ditelan akan mengunci
"domain tidak dikenal" selama 5 menit penuh. Exception tidak di-cache.
