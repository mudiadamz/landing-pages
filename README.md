# Landing Page Manager — ADM.UIUX

Marketplace produk digital (ebook, novel, template HTML, aset digital) milik
ADM.UIUX. Admin membuat & menjual produk; pembeli preview gratis, bayar via
Duitku (QRIS/e-wallet), lalu download atau baca langsung di situs.

Next.js 16 (App Router, Turbopack) · React 19 · Supabase · Vercel (region `sin1`).

**Satu deployment melayani beberapa domain**, tiap domain punya niche sendiri —
lihat [Multi-domain](#multi-domain).

## Quick start

```bash
npm install
cp .env.example .env.local     # lalu isi nilainya
npm run dev                    # http://localhost:3000
```

### Database

**Option A — Supabase CLI (local):**

```bash
npm run supabase:start   # Start local Supabase (Docker required)
npm run db:reset         # Apply migrations
```

Local URL: `http://localhost:54321` (dari `supabase status`). Pakai project URL &
anon key lokal di `.env.local`.

**Option B — Remote project:**

```bash
npx supabase login
npx supabase link --project-ref <your-project-id>
npm run db:push          # Push migrations to remote
```

> **Jebakan env di dev.** Next memuat `.env.development.local` **sebelum**
> `.env.local`, jadi kalau file itu ada dan menunjuk ke Supabase lokal
> (`http://127.0.0.1:54321`) sementara Supabase lokal tidak jalan, semua reader
> gagal *tanpa error yang terlihat* — hero, popup, produk, semuanya jatuh ke
> nilai bawaan dan halaman kelihatan kosong. Untuk menjalankan dev terhadap
> database remote, override lewat shell (process env menang atas file `.env`):
>
> ```bash
> NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… npm run dev
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
  Di Supabase → Auth → URL Configuration → **Redirect URLs**, tambahkan
  `<origin>/auth/callback` **untuk setiap domain** (termasuk
  `http://localhost:3000/auth/callback`). Sejak multi-domain, redirect mengikuti
  host request, bukan `NEXT_PUBLIC_SITE_URL`.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run supabase:start` / `:stop` / `:status` | Supabase lokal (Docker) |
| `npm run db:reset` | Re-apply semua migration ke DB lokal |
| `npm run db:push` | Push migration ke project remote |
| `npm run db:migrate` | Jalankan migration yang belum jalan |
| `npm run pdf:epub` | Konversi PDF → EPUB (`scripts/pdf-to-epub.mjs`) |
| `npm run gen:splash` | Generate splash screen iOS |

## Environment

Semua variabel + penjelasannya ada di [`.env.example`](.env.example). Yang wajib:
Supabase (URL, anon key, service role key), `NEXT_PUBLIC_SITE_URL`, Duitku, dan
Resend. Sisanya opsional (tracking, captcha, Vercel domain API).

## Multi-domain

Satu deployment, satu katalog, beberapa storefront. Tiap domain punya nama,
tagline, deskripsi SEO, hero, popup, tracking, dan custom JS sendiri — tapi
produknya **tidak diduplikasi**: domain memilih *kategori*, jadi satu produk bisa
tampil di beberapa storefront.

Dikelola di **`/panel/sites`**. Menambah domain butuh tiga tempat:

1. **Panel** — nama, niche, pengaturan per domain.
2. **Vercel** — otomatis kalau `VERCEL_API_TOKEN` diset (panel memakai REST API
   Vercel dan menampilkan record DNS yang diminta); manual kalau tidak.
3. **Supabase** — tambahkan `https://<domain>/auth/callback` ke Redirect URLs,
   kalau tidak login Google di domain itu gagal.

Sesi login tidak lintas domain (cookie Supabase per-domain) — itu disengaja. Maka:
route **pembeli** (`/panel/purchases`, invoice, favorit) jalan di **semua** domain,
karena sesi pembeli hanya ada di domain tempat dia beli. Yang canonical-only cuma
layar **admin** dan callback Duitku.

📖 Detail lengkap, jebakan cache, dan pola implementasi:
**[`docs/multi-domain.md`](docs/multi-domain.md)**

## Struktur

```
app/
  page.tsx              homepage (katalog, difilter per domain)
  lp/[slug]/            preview produk publik
  checkout/[slug]/      checkout + halaman "done"
  read/[slug]/          reader untuk pembeli
  panel/                admin & customer area  (CLAUDE.md sendiri di dalamnya)
  api/                  Duitku, download, epub, webhook, tracking
lib/
  actions/              Server Actions (semua mutasi lewat sini)
  supabase/             server / client / admin (service-role)
  site-resolve.ts       host → site, dasar multi-domain
  vercel-domains.ts     integrasi Vercel Domains API
supabase/migrations/    67 migration, berurutan timestamp
docs/                   catatan panjang (multi-domain, analytics, region)
```

## Konvensi

- Semua tabel app diawali **`lp_`** (satu Supabase dipakai beberapa app).
- Bahasa UI **Indonesia** (`<html lang="id">`, locale `id_ID`).
- Semua mutasi lewat Server Actions di `lib/actions/*.ts`; caching pakai
  `unstable_cache` + invalidasi per tag.
- Input file di panel **wajib** pakai `FileUploadCard`.
- Commit pakai email `mudi.adamz@gmail.com` (kalau tidak, deploy Vercel gagal).

Panduan arsitektur lengkap untuk agent AI ada di [`CLAUDE.md`](CLAUDE.md), dan
khusus area panel di [`app/panel/CLAUDE.md`](app/panel/CLAUDE.md).

## Deploy

```bash
vercel --prod --yes
```

Region function dipin ke `sin1` (`vercel.json`) supaya dekat database Supabase
Singapore. Perubahan `NEXT_PUBLIC_*` butuh redeploy karena di-inline saat build.

## Docs

| | |
|---|---|
| [`docs/multi-domain.md`](docs/multi-domain.md) | Beberapa domain, satu sistem |
| [`docs/supabase-region-migration.md`](docs/supabase-region-migration.md) | Pindah region Supabase |
| [`docs/ai-analytics-plan.md`](docs/ai-analytics-plan.md) | Rencana analytics |
| [`docs/campaign-reports/`](docs/campaign-reports/) | Laporan kampanye iklan (time series) |
