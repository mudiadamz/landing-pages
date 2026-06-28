# CLAUDE.md — Landing Page Manager (ADM.UIUX)

Panduan arsitektur & flow project untuk Claude Code. Project ini adalah **marketplace template landing page / digital assets** milik ADM.UIUX (Adam Mudianto). Admin membuat & menjual template HTML; customer membeli, membayar via Duitku, lalu download ZIP.

## Stack

- **Next.js 16** (App Router, React 19, Server Components + Server Actions)
- **Supabase** — Postgres + Auth (SSR) + Storage. CLI migrations di `supabase/migrations/`
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **Duitku** — payment gateway (QRIS, e-wallet, VA, dll.)
- **Resend** — email transaksional + inbound email (webhook)
- **Meta Pixel + Conversions API**, GA4, Vercel Analytics/Speed Insights — tracking
- **Monaco Editor** — editor HTML/CSS/JS in-browser
- **fflate** — unzip site bundle di sisi server

## Perintah

```bash
npm run dev              # next dev
npm run build            # next build
npm run lint             # eslint
npm run supabase:start   # Supabase lokal (butuh Docker)
npm run db:reset         # apply semua migration ke db lokal
npm run db:push          # push migration ke remote project
```

## Konvensi penting

- Semua tabel app diawali prefix **`lp_`** (mis. `lp_landing_pages`, `lp_purchases`, `lp_profiles`).
- Tabel lama pernah di-rename → lihat migration `2026062100xx_*` (pp_merge, tp_merge, lp_rename).
- Bahasa UI: **Indonesia** (`<html lang="id">`, locale `id_ID`).
- Tiga jenis Supabase client di `lib/supabase/`:
  - `server.ts` — `createClient()`, server components/actions, cookie-based, terkena RLS.
  - `client.ts` — `createClient()` browser.
  - `admin.ts` — `createAdminClient()` pakai **Service Role Key**, bypass RLS. **Hanya** untuk API routes (callback, webhook, hiring).
- Cursor rule aktif (`.cursor/rules/`): **selalu commit & push setelah menyelesaikan task** tanpa diminta.
- Kontak support hardcode di `lib/constants.ts` (`SUPPORT_CONTACT`).
- Server Actions semua di `lib/actions/*.ts`. Caching pakai `unstable_cache` + `revalidateTag`.

## Struktur direktori

```
app/
  page.tsx                       # homepage (hero, kategori, listing)
  lp/[slug]/                     # render landing page terpublish (di dalam iframe)
  checkout/[slug]/               # halaman beli + done (sukses/gagal)
  panel/                         # area login (admin & customer)
    landing-pages/[id]/edit/     # Monaco editor + asset + pricing + version history
    dashboard|users|categories|contacts|inbox|custom-js|invoices|profile
  api/
    duitku/create-invoice        # buat invoice → redirect ke Duitku
    duitku/callback              # webhook Duitku → simpan purchase, email, CAPI
    download/[slug]              # signed URL download ZIP (cek kepemilikan)
    hiring-test                  # submit tes skill + CV
    webhooks/resend/inbound      # email masuk dari Resend → lp_received_emails
    admin/users
  auth/callback                  # OAuth code exchange
  hiring/                        # halaman lowongan + tes skill
components/                      # UI komponen (header, footer, hero, trust-badges, tawk-chat, dll.)
lib/
  actions/                       # server actions (auth, landing-pages, purchases, dll.)
  supabase/                      # client server/browser/admin
  duitku.ts, invoice.ts, meta-capi.ts, analytics.ts, editor-utils.ts,
  preview-guard.ts, seo.ts, slug.ts, profile-utils.ts, hiring-questions.ts, constants.ts
supabase/migrations/             # SQL migrations (timestamp prefix)
middleware.ts                    # refresh sesi + proteksi /panel
```

## Auth & roles

- **Middleware** (`middleware.ts`): refresh sesi Supabase tiap request. `/panel/*` butuh login (redirect ke `/login`); user login yang buka `/login`/`/signup` diarahkan ke `/panel`.
- **Sign-in**: email/password (`lib/actions/auth.ts: login`) atau Google OAuth (`signInWithGoogle` → `/auth/callback` `exchangeCodeForSession`).
- **Profiles** (`lp_profiles`: `id`, `full_name`, `role`): `role ∈ {admin, customer}`. `getProfile()` cached; profil dibuat otomatis sebagai `customer` saat pertama diakses. `requireAdmin()` menjaga route admin.
- **Hanya admin** boleh buat/edit landing page & akses Dashboard/Users/Categories/Contacts/Inbox/Custom JS. Customer melihat pembelian, invoice, review.
- Role dinormalisasi case-insensitive via `lib/profile-utils.ts: normalizeRole()`.

## Flow: buat & edit landing page (admin)

1. **Buat**: `/panel/landing-pages/new` (`createLandingPage`) atau upload file `.html` via `/panel/upload`.
2. **Editor** (`app/panel/landing-pages/[id]/edit/editor.tsx`): Monaco tab HTML/CSS/JS, autosave debounce 2 detik, `Cmd/Ctrl+S` manual.
   - `lib/editor-utils.ts`: `parseHtmlContent()` pisah `<style>`/`<script>`; `mergeHtmlContent()` gabung lagi sebelum simpan ke `html_content`.
   - Setiap simpan → `updateLandingPageHtml()` + `saveVersion()` (snapshot ke `lp_landing_page_versions`, history sampai 50).
3. **Assets** (`asset-upload.tsx`):
   - Gambar/video → Storage `landing-assets/{userId}/{pageId}/{ts}-{file}`, dapat public URL.
   - **ZIP site** → `uploadSiteZip()`: unzip (fflate), upload semua file ke `.../site/...`, inject `<base href>` ke direktori storage, cari `index.html` terdangkal, update `html_content`.
4. **Pricing** (`pricing-form.tsx`): `price`, `price_discount`, `is_free`, `thumbnail_url`, `category_id` (hierarki parent→child), `long_description`, plus upload ZIP download (file yang diterima customer).

## Flow: render landing page publik (`/lp/[slug]`)

- `getPageBySlug()` ambil `html_content` (di-`cache()`). `generateMetadata()` bangun OG/canonical.
- HTML dirender di dalam `<iframe srcDoc={guardPreviewHtml(html)}>` sandbox `allow-scripts allow-same-origin allow-modals`.
- `lib/preview-guard.ts` inject CSS+JS anti-copy (blok klik kanan, copy/cut/drag/select, F12, Ctrl+S/U/P/A/C/X, devtools). Anchor `#section` di-handle agar scroll in-page.
- `preview-bar.tsx`: tombol "Kembali" + tombol Beli ("Ambil gratis" / "Checkout" / link eksternal).

## Flow: checkout & pembayaran (inti bisnis)

```
/checkout/[slug] (checkout-form.tsx)
  ├─ Gratis + login        → addPurchaseAction → insert lp_purchases (amount 0, method "free")
  ├─ Belum login           → tombol Google / email login
  ├─ Ada purchaseLink      → redirect ke URL eksternal
  └─ Berbayar + login      → POST /api/duitku/create-invoice
        └─ createDuitkuInvoice() (lib/duitku.ts)
             • signature MD5(merchantCode + amount + merchantOrderId + apiKey)
             • merchantOrderId = LP_{pageIdHex}_{userIdHex}
             • additionalParam = JSON {lp, u, e(email)}  ← dipakai callback decode
             • callbackUrl = SITE_URL/api/duitku/callback
             • returnUrl   = SITE_URL/checkout/{slug}/done
        → balas { paymentUrl } → frontend redirect ke gateway Duitku
                 ↓ user bayar
POST /api/duitku/callback   (server-to-server, balas 200 "OK" cepat)
  • verifikasi signature
  • resultCode !== "00" → stop (gagal)
  • resultCode === "00":
      - insert lp_purchases (invoice_number = INV-YYYYMMDD-XXXXX via lib/invoice.ts,
        payment_method dari paymentCode). Idempoten: UNIQUE(user_id, landing_page_id).
      - sendPurchaseConfirmationEmail() (Resend) berisi link download
      - sendMetaPurchaseEvent() (Meta CAPI, lib/meta-capi.ts) eventId = merchantOrderId
                 ↓ Duitku redirect
/checkout/[slug]/done
  • cek record purchase di DB (callback mungkin masih in-flight → tampilkan "diproses")
  • jika ada → tombol "Download ZIP" → /api/download/{slug}
  • PurchaseTracker fires event `purchase` (GA4 + Meta Pixel), dedup via merchantOrderId
GET /api/download/[slug]
  • cek login + ada record di lp_purchases (RLS)
  • generate signed URL Supabase Storage → redirect
```

### Tabel `lp_purchases`
`id, user_id (FK auth.users), landing_page_id (FK lp_landing_pages), purchased_at, amount, payment_method, invoice_number (UNIQUE), UNIQUE(user_id, landing_page_id)`.

## Tracking & analytics

- `lib/analytics.ts`: helper gtag/fbq. Event: `view_item`, `begin_checkout`, `purchase`.
- **Dedup Meta**: pixel browser & CAPI server pakai `eventId = merchantOrderId` yang sama → 1 konversi. `PurchaseTracker` cek localStorage agar tak double-fire saat refresh.
- Script marketing diinject via `components/marketing-scripts.tsx`; chat via `components/tawk-chat.tsx`; custom JS global dari `lp_site_settings` (key `custom_js`) via panel Custom JS.

## Flow sekunder

- **Hiring** (`/hiring`, `/hiring/test`): 10 soal situasional (`lib/hiring-questions.ts`) + upload CV PDF (≤5MB). `POST /api/hiring-test` upload CV ke bucket `hiring-cv` (admin client) lalu email hasil via Resend.
- **Inbound email** (`/api/webhooks/resend/inbound`): Resend kirim event `email.received` (verifikasi svix). Disimpan ke `lp_received_emails`, dibaca di panel Inbox. Butuh `RESEND_WEBHOOK_SECRET`.
- **Contacts** (`components/contact-form.tsx` → `lp_contacts`), dibaca admin di `/panel/contacts`.
- **Reviews** (`lp_reviews`), **categories** (`lp_landing_page_categories`, hierarki via `parent_id`), **site settings** (`lp_site_settings`).
- SEO: `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, `lib/seo.ts`, JSON-LD Organization di `app/layout.tsx`.

## Environment variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY          # admin client (callback, webhook, hiring)

# Site
NEXT_PUBLIC_SITE_URL               # untuk callbackUrl/returnUrl & metadata (default admuiux.com)

# Duitku
DUITKU_MERCHANT_CODE
DUITKU_API_KEY
DUITKU_SANDBOX                     # "true" sandbox, selain itu produksi

# Resend
RESEND_API_KEY
RESEND_FROM                        # default onboarding@resend.dev
RESEND_WEBHOOK_SECRET              # verifikasi inbound webhook

# Meta / tracking
NEXT_PUBLIC_FB_PIXEL_ID
META_CAPI_ACCESS_TOKEN
META_CAPI_VERSION                  # default v21.0
```
(lihat `.env.example`, `.env.local`, `.env.development.local`)

## Catatan migration

- Migration berurutan timestamp di `supabase/migrations/`. Yang terbaru per Jun 2026: `category_parent`, `landing_assets_site_zip`, `pp_presence_owner`.
- Rangkaian `2026062100xx` adalah rename/merge tabel lama — perhatikan saat menyentuh nama tabel/kolom.
