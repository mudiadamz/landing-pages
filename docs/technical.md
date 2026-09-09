# Panduan teknis

Setup, operasional, dan konvensi untuk developer. Gambaran produknya (untuk
non-developer) ada di [`README.md`](../README.md).

Next.js 16 (App Router, Turbopack) · React 19 · Supabase · Vercel (region `sin1`).

**Satu deployment melayani beberapa domain**, tiap domain punya niche sendiri —
lihat [Multi-domain](#multi-domain).

## Quick start

> Repo ini memakai **pnpm** (versinya dipatok di `packageManager`). `npm install`
> sengaja gagal — lihat `scripts/only-pnpm.mjs`.

```bash
pnpm install
cp .env.example .env.local     # lalu isi nilainya
pnpm dev                    # http://localhost:3000
```

### Database

**Option A — Supabase CLI (local):**

```bash
pnpm supabase:start   # Start local Supabase (Docker required)
pnpm db:reset         # Apply migrations
```

Local URL: `http://localhost:54321` (dari `supabase status`). Pakai project URL &
anon key lokal di `.env.local`.

**Option B — Remote project:**

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <your-project-id>
pnpm db:push          # Push migrations to remote
```

> **Jebakan env di dev.** Next memuat `.env.development.local` **sebelum**
> `.env.local`, jadi kalau file itu ada dan menunjuk ke Supabase lokal
> (`http://127.0.0.1:54321`) sementara Supabase lokal tidak jalan, semua reader
> gagal *tanpa error yang terlihat* — hero, popup, produk, semuanya jatuh ke
> nilai bawaan dan halaman kelihatan kosong. Untuk menjalankan dev terhadap
> database remote, override lewat shell (process env menang atas file `.env`):
>
> ```bash
> NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… pnpm dev
> ```

### Auth providers

- **Email verification:** signup tidak menunggu verifikasi Supabase
  (`mailer_autoconfirm`). Bukti kepemilikan alamat ada di
  `lp_profiles.email_verified_at`, diisi lewat email Resend sendiri.
- **Google OAuth:** aktifkan provider Google di Supabase Dashboard → Auth →
  Providers → Google, isi Client ID & Secret dari
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
  Di Google, *Authorized redirect URI* = callback **Supabase**
  (`https://<ref>.supabase.co/auth/v1/callback`) — satu nilai untuk semua domain.
- **Redirect URLs Supabase** (Auth → URL Configuration) cukup berisi callback
  domain kanonik (`<NEXT_PUBLIC_SITE_URL>/auth/callback`) plus
  `http://localhost:3000/auth/callback` untuk dev. Login dari storefront lain
  kembali ke callback kanonik dengan `?sf=<host>`, lalu dipantulkan ke domain
  asalnya — jadi **domain baru tidak perlu didaftarkan di Supabase**. Aturan &
  penjagaannya di [`lib/oauth-return.ts`](../lib/oauth-return.ts).

## Scripts

| Command | |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm supabase:start` / `:stop` / `:status` | Supabase lokal (Docker) |
| `pnpm db:reset` | Re-apply semua migration ke DB lokal |
| `pnpm db:push` | Push migration ke project remote |
| `pnpm db:migrate` | Jalankan migration yang belum jalan |
| `pnpm pdf:epub` | Konversi PDF → EPUB (`scripts/pdf-to-epub.mjs`) |
| `pnpm i18n:scan` | Pindai string hardcode → `docs/i18n-backlog.md` |
| `pnpm test` / `test:watch` | Unit test (vitest) |

## Environment

Semua variabel + penjelasannya ada di [`.env.example`](../.env.example). Yang wajib:
Supabase (URL, anon key, service role key), `NEXT_PUBLIC_SITE_URL`, Duitku, dan
Resend. Sisanya opsional (tracking, captcha, Vercel domain API).

## Multi-domain

Satu deployment, satu katalog, beberapa storefront. Tiap domain punya nama,
tagline, deskripsi SEO, **template tampilan**, hero, popup, tracking, dan custom JS
sendiri — tapi produknya **tidak diduplikasi**: domain memilih *kategori*, jadi
satu produk bisa tampil di beberapa storefront.

Palet warna juga per domain (5 preset contrast-checked, dipilih di `/panel/branding` →
**Tampilan → Palet warna**). Toggle terang/gelap sengaja disembunyikan di semua halaman publik;
di panel masih ada.

Dikelola di dua layar: **`/panel/sites`** untuk hostname/Vercel/aktif, dan
**`/panel/branding`** untuk nama, logo, template, palet, dan niche — dipisah karena
mengubah host butuh DNS sementara mengubah tagline tidak. Menambah domain butuh dua
tempat:

1. **Panel** — hostname di `/panel/sites`, lalu nama/logo/template/niche di
   `/panel/branding`.
2. **Vercel** — otomatis kalau `VERCEL_API_TOKEN` diset (panel memakai REST API
   Vercel dan menampilkan record DNS yang diminta); manual kalau tidak.

Supabase tidak perlu disentuh — lihat **Redirect URLs** di [Auth providers](#auth-providers).

Sesi login tidak lintas domain (cookie Supabase per-domain) — itu disengaja. Maka:
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
  api/                  Duitku, download, epub, webhook, tracking
lib/
  actions/              Server Actions (semua mutasi lewat sini)
  supabase/             server / client / admin (service-role)
  site-resolve.ts       host → site, dasar multi-domain
  vercel-domains.ts     integrasi Vercel Domains API
  templates/            frontend per niche — registry.tsx + satu folder per template
supabase/migrations/    migration, berurutan timestamp
docs/                   catatan panjang (arsitektur, multi-domain, analytics, region)
```

## Konvensi

- Semua tabel app diawali **`lp_`** (satu Supabase dipakai beberapa app).
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
- Commit pakai email `mudi.adamz@gmail.com` (kalau tidak, deploy Vercel gagal).

Panduan arsitektur lengkap untuk agent AI ada di [`CLAUDE.md`](../CLAUDE.md), dan
khusus area panel di [`app/panel/CLAUDE.md`](../app/panel/CLAUDE.md).

## Deploy (Docker)

Satu container aplikasi di belakang Caddy. Supabase tetap di project hosted —
yang di-self-host cuma aplikasinya.

```bash
cp .env.example .env.production        # isi: Supabase, Duitku, Resend, ACME_EMAIL
docker compose --env-file .env.production up -d --build
```

Satu berkas env untuk dua keperluan: `--env-file` mengisi build arg, `env_file:`
di compose mengirim rahasianya ke dalam container.

**`NEXT_PUBLIC_*` disulih saat BUILD, bukan saat run.** Nilainya ikut masuk ke
bundle yang dikirim ke browser, jadi mengubahnya lewat `docker run -e` tidak
berpengaruh pada apa pun yang berjalan di sana. Ganti nilainya → **build ulang**.
(Anon key memang aman ikut ke image — ia dikirim ke setiap pengunjung. Service
role key tidak boleh, dan tidak pernah jadi build arg.)

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
docker compose logs -f app                                # log aplikasi
docker compose ps                                         # status + health
curl -fsS https://admuiux.com/api/health                  # {"ok":true}
```

## Docs

| | |
|---|---|
| [`architecture.md`](architecture.md) | **Aturan yang mengatur codebase**: batas antar lapisan, invarian, pola, jebakan struktural |
| [`multi-domain.md`](multi-domain.md) | Beberapa domain, satu sistem |
| [`mbahgpt.md`](mbahgpt.md) | Template chat MbahGPT + backend-nya |
| [`plans/`](plans/) | Rencana berjalan (multi-fase) |
| [`supabase-region-migration.md`](supabase-region-migration.md) | Pindah region Supabase |
| [`ai-analytics-plan.md`](ai-analytics-plan.md) | Rencana analytics |
