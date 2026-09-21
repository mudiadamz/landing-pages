# Panduan teknis

Setup, operasional, dan konvensi untuk developer. Gambaran produknya (untuk
non-developer) ada di [`README.md`](../README.md).

Next.js 16 (App Router, Turbopack) · React 19 · PostgreSQL 17 · Docker + Caddy.

**Satu deployment melayani beberapa domain**, tiap domain punya niche sendiri —
lihat [Multi-domain](#multi-domain).

## Quick start

> Repo ini memakai **pnpm** (versinya dipatok di `packageManager`). `npm install`
> sengaja gagal — lihat `scripts/only-pnpm.mjs`.

```bash
pnpm install
colima start                   # atau Docker Desktop — cukup untuk satu container
pnpm db:up                     # Postgres 17 dari compose.dev.yml, port 54329
pnpm db:migrate --seed         # db/migrations + contoh data (db/seed.sql)
pnpm dev                       # http://127.0.0.1:3000
```

### Database

Postgres polos, satu container (`compose.dev.yml`, project `lp-dev`, database
`lp`). Tidak ada Supabase, PostgREST, atau GoTrue: aplikasi bicara SQL langsung
lewat `lib/backend/` (`pg`), sebagai role `app`, dan setiap query berjalan di
dalam transaksi yang sudah berganti ke `anon` / `authenticated` / `service_role`
— jadi RLS & grant tetap yang memutuskan.

Isi `.env.development.local` untuk dev:

```bash
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
DATABASE_URL=postgresql://app:app@127.0.0.1:54329/lp               # aplikasi
MIGRATE_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/lp  # migration (pemilik)
APP_DB_PASSWORD=app            # db:migrate memberi role app password ini
STORAGE_SIGNING_SECRET=<acak, ≥32 karakter>
STORAGE_ROOT=.storage          # file unggahan, di-gitignore
```

- **Migration** ada di `db/migrations/`, dimulai dari
  `00000000000000_baseline.sql` (seluruh skema + shim role & `auth.uid()`).
  `pnpm db:migrate` (`scripts/migrate.mjs`) menerapkan yang belum jalan, satu
  transaksi per file, dan **menolak** migration lama yang isinya berubah
  (checksum). Riwayat era Supabase: `db/migrations/_archive/`, hanya bacaan.
- **Role `app` bukan pemilik.** Ia boleh `set role` ke tiga role di atas, tapi
  tanpa itu tidak menyentuh tabel `lp_` mana pun; langsung hanya ke
  `auth.users`, `auth.identities`, dan `app_auth.*`. Error "password
  authentication failed for user app" = `APP_DB_PASSWORD` belum diterapkan —
  jalankan `pnpm db:migrate` lagi.
- **Tes** (`pnpm test:db`) memakai server yang sama tapi membangun database
  `lp_test` sendiri dari nol setiap kali jalan.

### Auth providers

Auth milik aplikasi sendiri (`lib/backend/auth.ts`, `lib/auth/`), di atas tabel
`auth.users` yang sama — hash bcrypt lama tetap berlaku.

- **Sesi:** token opak di cookie httpOnly `lp_session` (`__Host-lp_session` di
  HTTPS), hanya sha256-nya yang disimpan di `app_auth.sessions`, berlaku 30 hari
  sejak terakhir dipakai. Logout dan ban mencabutnya saat itu juga.
- **Email verification:** signup langsung aktif. Bukti kepemilikan alamat ada di
  `lp_profiles.email_verified_at`, diisi lewat email Resend sendiri
  (`lib/email-verify.ts`).
- **Google:** `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` dari
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  (OAuth + PKCE tanpa SDK, `lib/backend/google.ts`). *Authorized redirect URIs*
  cukup `https://<host kanonik>/auth/callback` plus
  `http://localhost:3000/auth/callback` untuk dev. Login dari storefront lain
  pulang ke callback kanonik dengan host asalnya di dalam `state`, lalu `code`-nya
  diteruskan ke domain asal yang memegang verifier PKCE — jadi **domain baru
  tidak perlu didaftarkan di Google**. Aturan & penjagaannya di
  [`lib/oauth-return.ts`](../lib/oauth-return.ts). Keduanya kosong = tombol Google
  menjawab "belum dikonfigurasi".

## Scripts

| Command | |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm db:up` | Postgres dev (`compose.dev.yml`, port 54329) |
| `pnpm db:migrate` | Terapkan migration yang belum jalan (`--seed`: plus `db/seed.sql`, `--status`: daftar saja) |
| `pnpm pdf:epub` | Konversi PDF → EPUB (`scripts/pdf-to-epub.mjs`) |
| `pnpm i18n:scan` | Pindai string hardcode → `docs/i18n-backlog.md` |
| `pnpm test` / `test:watch` | Unit test (vitest), tanpa Docker |
| `pnpm test:db` | Tes database, RLS, auth, storage — butuh `pnpm db:up` |

## Environment

Semua variabel + penjelasannya ada di [`.env.example`](../.env.example). Yang wajib:
`DATABASE_URL` (di produksi diisi compose sendiri), `STORAGE_SIGNING_SECRET`,
`NEXT_PUBLIC_SITE_URL`, Duitku, dan Resend. Di server juga `POSTGRES_PASSWORD` dan
`APP_DB_PASSWORD`. Sisanya opsional (Google, tracking, captcha, OpenRouter).

## Multi-domain

Satu deployment, satu katalog, beberapa storefront. Tiap domain punya nama,
tagline, deskripsi SEO, **template tampilan**, hero, popup, tracking, dan custom JS
sendiri — tapi produknya **tidak diduplikasi**: domain memilih *kategori*, jadi
satu produk bisa tampil di beberapa storefront.

Palet warna juga per domain (5 preset contrast-checked, dipilih di `/panel/branding` →
**Tampilan → Palet warna**). Toggle terang/gelap sengaja disembunyikan di semua halaman publik;
di panel masih ada.

Dikelola di dua layar: **`/panel/sites`** untuk hostname/aktif, dan
**`/panel/branding`** untuk nama, logo, template, palet, dan niche — dipisah karena
mengubah host butuh DNS sementara mengubah tagline tidak. Menambah domain butuh dua
tempat:

1. **Panel** — hostname di `/panel/sites`, lalu nama/logo/template/niche di
   `/panel/branding`.
2. **DNS** — arahkan domainnya ke IP server. Tidak ada pendaftaran ke mana pun:
   Caddy menerbitkan sertifikatnya sendiri sesudah bertanya ke `/api/tls-check`,
   yang jawabannya berasal dari baris langkah 1.

Google Cloud Console tidak perlu disentuh — lihat [Auth providers](#auth-providers).

Sesi login tidak lintas domain (cookie `lp_session` per-domain) — itu disengaja. Maka:
route **pembeli** (`/panel/purchases`, invoice, favorit) jalan di **semua** domain,
karena sesi pembeli hanya ada di domain tempat dia beli. Yang canonical-only cuma
layar **admin** dan callback Duitku.

Tiap domain juga punya **logo** (wordmark lebar, dipakai di header) dan **ikon**
(persegi, dipakai di tab browser, install PWA, apple-touch, dan avatar Link in bio).
Diupload di `/panel/branding`; dikosongkan = pakai lambang ADM.UIUX. Ikon raster harus
persegi minimal 192×192 dan bukan JPEG — sisanya di [`multi-domain.md`](multi-domain.md) →
"Logo & ikon".

📖 Detail lengkap, jebakan cache, dan pola implementasi:
**[`multi-domain.md`](multi-domain.md)**

## Template tampilan

Tiap domain memilih frontend-nya sendiri, supaya storefront niche tidak semuanya
terlihat seperti marketplace template. Dipilih di `/panel/branding` → **Tampilan**.

| Key | Label | Untuk |
|---|---|---|
| `default` | Marketplace | Hero besar, grid 3 kolom, testimoni, blok founder. Katalog campuran. |
| `pustaka` | Pustaka | Rak buku: sampul portrait 2:3, masthead editorial, header/footer sendiri, tanpa blok founder. Ebook, novel, bacaan. |
| `linkbio` | Link in bio | Satu kolom ala Linktree: avatar, bio, tumpukan tombol. **Tanpa header di halaman depan.** Untuk bio Instagram/TikTok. |
| `mbahgpt` | MbahGPT (chat) | Chatbox penuh layar ke model OpenRouter. Butuh `OPENROUTER_API_KEY`. Detail: [`mbahgpt.md`](mbahgpt.md). |

**Yang dikuasai template** — badge-nya tampil live di picker `/panel/branding`,
diturunkan dari registry sendiri jadi tidak bisa basi:

| Slot | Wajib | Halaman |
|---|---|---|
| `Home` | ✅ | `/` |
| `Header` | ✅ | semua halaman publik |
| `Footer` | ✅ | semua halaman publik |
| `Category` | opsional | `/category/[slug]` |
| `Categories` | opsional | `/categories` |

Slot opsional yang tidak diisi **jatuh ke versi Marketplace**, jadi tema baru cuma
menulis permukaan yang niche-nya benar-benar beda — bukan seluruh situs.
`defaultPalette` menandai palet yang tema itu dirancang untuknya; cuma saran di
picker, karena palet tersimpan per domain.

**Sengaja TIDAK per-template** (alasan lengkap di `registry.tsx`):

| Halaman | Alasan |
|---|---|
| `/checkout/*` | alur pembayaran — mem-fork-nya menambah risiko, bukan identitas |
| `/preview/[slug]`, `/read/[slug]` | permukaan baca, tanpa chrome by design |
| `/privacy` `/terms` `/refund` | teks legal, kewajiban identik di tiap domain |
| `/about` `/contact` `/hiring*` | halaman brand induk |
| `/login` `/signup` | layar auth, tanpa header/footer |

**Menambah template baru** — tidak perlu migration:

1. Buat `lib/templates/<key>/home.tsx`, export satu komponen bertipe `TemplateProps`.
2. Tambah entry di [`lib/templates/registry.tsx`](../lib/templates/registry.tsx)
   (`key`, `label`, `description`, `Home`, `Header`, `Footer`; `Category`,
   `Categories`, `defaultPalette` opsional).

`lp_sites.template` itu **teks bebas** yang divalidasi terhadap registry, bukan enum
DB — jadi menambah/menghapus template tidak menyentuh skema, dan key yang tidak
dikenal jatuh ke `default` alih-alih membuat halaman error.

Dua aturan yang dijaga desainnya:

- **`app/page.tsx` yang mengambil semua data**; semua template menerima props yang
  sama. Template menentukan *tampilan*, bukan *data apa yang boleh dilihat* — jadi
  template baru tidak bisa mengulang bug "semua produk tampil di semua domain"
  dengan fetch caranya sendiri.
- **Halaman produk (`/preview/[slug]`), checkout, dan reader dipakai bersama.** Alur beli
  tidak perlu dipelajari ulang per domain, dan mem-fork alur pembayaran cuma
  menambah risiko. Header & footer justru per-template (lihat di atas).

Tiap template menandai dirinya dengan `data-template="<key>"` di elemen root —
dipakai untuk menargetkan CSS, dan supaya "template mana yang benar-benar
dirender" bisa dicek satu baris:

```bash
curl -s https://domain-anda.com/ | grep -o 'data-template="[a-z]*"'
```

## Preview & SEO

Preview produk ada di **`/preview/[slug]`** (dulu `/lp/[slug]`).

- `/lp/:slug` **redirect permanen (308)** ke `/preview/:slug`. Wajib ada: iklan
  Instagram/Facebook yang jalan menunjuk ke URL `/lp/`, begitu juga link yang sudah
  dibagikan, kartu OG yang sudah di-scrape, dan email konfirmasi yang sudah terkirim.
- **Preview sengaja tidak di-index.** Halaman itu memberikan isi berbayar secara
  gratis, dan excerpt yang ter-index adalah pintu depan scraper. Lapisannya:
  `robots: { index: false, follow: false, nocache: true }` di halaman,
  header `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` untuk
  `/preview/*`, `/lp/*` dan endpoint `/api/epub-{text,asset,cover}/*`
  (`next.config.ts`), plus `/preview` `/lp` `/read` di Disallow `robots.txt`.
- **Tag `og:` & `twitter:` tetap ada.** Itu kartu link, bukan indexing — tanpa itu
  semua kreatif iklan dan link yang dibagikan tampak rusak.
- **Produk di sitemap menunjuk `/checkout/[slug]`,** bukan preview. Rumah produk yang
  boleh di-index adalah checkout (publik, ada judul/deskripsi/harga/ulasan);
  `canonical` di preview juga mengarah ke sana. Kalau preview di-noindex *dan*
  dikeluarkan dari sitemap tanpa pengganti, seluruh katalog hilang dari pencarian.
- Bot dengan user-agent **tidak** diblokir. Daftar blokir hampir selalu memuat
  `facebookexternalhit`, dan itu bot yang mengambil kartu preview untuk iklan
  Facebook/Instagram — memblokirnya merusak sumber trafik utama.

Analitik: `pageType()` di `lib/journey.ts` mengenali **dua** prefix (`/preview/` dan
`/lp/`), karena `lp_page_events` menyimpan berbulan-bulan baris dengan path lama.

## Struktur

```
app/
  page.tsx              homepage (katalog, difilter per domain)
  preview/[slug]/       preview produk publik (noindex; /lp/* redirect ke sini)
  checkout/[slug]/      checkout + halaman "done"
  read/[slug]/          reader untuk pembeli
  panel/                admin & customer area  (CLAUDE.md sendiri di dalamnya)
  api/                  Duitku, download, epub, webhook, tracking, storage, auth
  storage/v1/object/    file publik & file privat ber-URL bertanda
lib/
  actions/              Server Actions (semua mutasi lewat sini)
  db/                   client: server (user dari sesi) / anon / admin (service_role) / client (browser)
  backend/              SQL ke Postgres: withRls, query builder, auth, storage, Google
  auth/                 cookie sesi (currentUser, startSession, endSession)
  site-resolve.ts       host → site, dasar multi-domain
  templates/            frontend per niche — registry.tsx + satu folder per template
proxy.ts                validasi sesi untuk /panel, /read, /login, /signup (runtime Node)
db/migrations/          baseline + migration sesudahnya; _archive/ = riwayat era Supabase
scripts/                migrate, backup, restore-drill, alat cutover
docs/                   catatan panjang (arsitektur, multi-domain, analytics, region)
```

## Konvensi

- Semua tabel app diawali **`lp_`** (konvensi sejak database ini dipakai bersama
  app lain; tetap dipakai supaya nama tabel konsisten dan tes RLS bisa memilihnya).
- Bahasa UI **Indonesia** (`<html lang="id">`, locale `id_ID`).
- Semua mutasi lewat Server Actions di `lib/actions/*.ts`; caching pakai
  `unstable_cache` + invalidasi per tag.
- **Jebakan invalidasi:** `updateTag()` **tidak** membatalkan entry `unstable_cache`
  yang di-tag lewat opsi `{ tags: [...] }` — sumber tag yang didukungnya adalah
  fetch tags dan `cacheTag()` di dalam `'use cache'`. Pakai
  `revalidateTag(tag, "max")` (profil wajib di Next 16.1.6). Terukur: tanpa itu,
  perubahan di panel tidak sampai ke halaman publik sampai window TTL habis atau
  ada deploy baru. `lib/actions/sites.ts` sudah benar; call site `updateTag` lain
  (categories, hero, content, tracking, popup) belum diverifikasi.
- Input file di panel **wajib** pakai `FileUploadCard`.
- Commit pakai email `mudi.adamz@gmail.com`, tanpa trailer `Co-Authored-By:
  Claude…` — riwayat repo ini atas nama Adam.

Panduan arsitektur lengkap untuk agent AI ada di [`CLAUDE.md`](../CLAUDE.md), dan
khusus area panel di [`app/panel/CLAUDE.md`](../app/panel/CLAUDE.md).

## Deploy (Docker)

Semuanya di satu server: Postgres, aplikasi, dan Caddy. Tidak ada layanan
database/auth/storage di luar.

```bash
cp .env.example .env.production        # isi: POSTGRES_PASSWORD, APP_DB_PASSWORD,
                                       # STORAGE_SIGNING_SECRET, Duitku, Resend, ACME_EMAIL, …
docker compose --env-file .env.production up -d --build
```

Urutan naiknya: `db` (postgres:17, volume `pgdata`) sehat → `migrate` (sekali
jalan, sebagai pemilik: `db/migrations` + memberi role `app` password
`APP_DB_PASSWORD`) keluar 0 → `app` (sebagai role `app`, volume `storage` di
`/srv/storage`) sehat → Caddy. Deploy yang membawa migration gagal **berhenti di
`migrate`** — app lama tetap jalan.

- `POSTGRES_PASSWORD` dan `APP_DB_PASSWORD`: **hex saja** (`openssl rand -hex 32`),
  karena keduanya masuk ke URL koneksi. `DATABASE_URL` tidak perlu diisi —
  compose menetapkannya ke container `db`.
- `STORAGE_SIGNING_SECRET`: menandatangani URL unduhan privat; menggantinya
  membatalkan URL yang sudah dibagikan (umurnya ≤ 1 jam).

Satu berkas env untuk dua keperluan: `--env-file` mengisi build arg & password
database, `env_file:` di compose mengirim rahasianya ke dalam container.

**`NEXT_PUBLIC_*` disulih saat BUILD, bukan saat run.** Nilainya ikut masuk ke
bundle yang dikirim ke browser, jadi mengubahnya lewat `docker run -e` tidak
berpengaruh pada apa pun yang berjalan di sana. Ganti nilainya → **build ulang**.
Tidak satu pun rahasia boleh jadi build arg.

### Backup

Tanggung jawab kita sendiri sekarang. `scripts/backup.sh` (dari folder repo di
server) membuat `db-<waktu>.dump` (`pg_dump -Fc`) dan `storage-<waktu>.tgz`,
menyimpan 14 hari, dan menyalinnya keluar lewat rclone kalau `RCLONE_REMOTE`
diisi — tanpa itu backup ada di disk yang sama dengan database.

```bash
crontab -e   # 15 3 * * *  cd /srv/landing_pages && scripts/backup.sh >> /var/log/lp-backup.log 2>&1
```

Backup yang belum pernah di-restore belum terbukti ada: salin satu ke mesin
pengembang dan jalankan `scripts/restore-drill.sh db-….dump` (restore ke
database kosong di container dev, lalu cek jumlah baris, RLS, dan migration).

Pindah sekali jalan dari Supabase hosted: [`runbooks/cutover-supabase.md`](runbooks/cutover-supabase.md).

### Menambah domain

1. `/panel/sites` → **Tambah domain**, simpan barisnya.
2. Arahkan DNS-nya: A record ke IP server, atau CNAME ke host kanonik.

Tidak ada langkah ketiga. Caddy menerbitkan sertifikat saat permintaan pertama
untuk domain itu datang, sesudah bertanya ke `/api/tls-check` — yang menjawab
dari `lp_sites`. Gerbang itu bukan formalitas: tanpanya, siapa pun yang
mengarahkan domainnya ke IP server ini bisa memaksa penerbitan sertifikat, dan
rate limit Let's Encrypt dihitung per akun.

### Perintah harian

```bash
docker compose --env-file .env.production up -d --build   # deploy ulang
docker compose --env-file .env.production logs -f app     # log aplikasi
docker compose --env-file .env.production ps              # status + health (migrate: Exited 0)
curl -fsS https://admuiux.com/api/health                  # {"ok":true}
```

## Docs

| | |
|---|---|
| [`architecture.md`](architecture.md) | **Aturan yang mengatur codebase**: batas antar lapisan, invarian, pola, jebakan struktural |
| [`multi-domain.md`](multi-domain.md) | Beberapa domain, satu sistem |
| [`mbahgpt.md`](mbahgpt.md) | Template chat MbahGPT + backend-nya |
| [`plans/`](plans/) | Rencana berjalan (multi-fase) |
| [`runbooks/`](runbooks/) | Prosedur sekali jalan (cutover dari Supabase) |
| [`ai-analytics-plan.md`](ai-analytics-plan.md) | Rencana analytics |
