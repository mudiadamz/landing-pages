# CLAUDE.md — Landing Page Manager (ADM.UIUX)

Panduan arsitektur & flow project untuk Claude Code. Project ini adalah **marketplace template landing page / digital assets** milik ADM.UIUX (Adam Mudianto). Admin membuat & menjual template HTML; customer membeli, membayar via Duitku, lalu download ZIP.

## Konvensi penting

- Semua tabel app diawali prefix **`lp_`** (mis. `lp_landing_pages`, `lp_purchases`, `lp_profiles`).
- Tabel lama pernah di-rename → lihat migration `2026062100xx_*` (pp_merge, tp_merge, lp_rename).
- Bahasa UI: **Indonesia** (`<html lang="id">`, locale `id_ID`).
- Tiga jenis Supabase client di `lib/supabase/`:
  - `server.ts` — `createClient()`, server components/actions, cookie-based, terkena RLS.
  - `client.ts` — `createClient()` browser.
  - `admin.ts` — `createAdminClient()` pakai **Service Role Key**, bypass RLS. **Hanya** untuk API routes (callback, webhook, hiring).
- Selesai task → **commit** tanpa diminta. **Jangan `git push`**: push diblokir di
  settings user (deny rule + PreToolUse hook), jadi setiap percobaan pasti gagal —
  termasuk kalau diselipkan di rantai `&&`. Adam yang push sendiri.
  (`.cursor/rules/commit-push-after-finish.mdc` masih menyebut push — itu untuk Cursor.)
- **Semua input file di panel WAJIB pakai `FileUploadCard`** (`components/file-upload-card.tsx`).
  Jangan pernah menulis `<input type="file">` telanjang di layar panel — kartu ini
  yang memegang state kosong/terisi, nama + ukuran file, tombol ganti & hapus,
  dan tampilan error. Dulu komponennya privat di `product-edit-form.tsx` lalu
  layar lain menumbuhkan input file sendiri yang bentuknya beda; sekarang satu
  komponen dipakai bersama.
- Kontak support hardcode di `lib/constants.ts` (`SUPPORT_CONTACT`).
- Server Actions semua di `lib/actions/*.ts`. Caching pakai `unstable_cache` + `revalidateTag`.

## Auth & roles

- **Middleware** (`middleware.ts`): refresh sesi Supabase tiap request. `/panel/*` butuh login (redirect ke `/login`); user login yang buka `/login`/`/signup` diarahkan ke `/panel`.
- **Sign-in**: email/password (`lib/actions/auth.ts: login`) atau Google OAuth (`signInWithGoogle` → `/auth/callback` `exchangeCodeForSession`).
- **Verifikasi email**: signup **tidak** menunggu verifikasi — project Supabase pakai
  `mailer_autoconfirm=true`, jadi `auth.users.email_confirmed_at` cuma berarti "boleh
  login". Bukti kepemilikan alamat ada di `lp_profiles.email_verified_at`, diisi lewat
  email Resend sendiri (`lib/email-verify.ts` → `/auth/verify-email`, token HMAC 24 jam).
  Signup Google langsung terverifikasi (lihat trigger `lp_handle_new_user`). Selama belum
  verified, `EmailConfirmBanner` selalu tampil di `/panel`; admin melihat statusnya +
  filter "Belum verifikasi" di `/panel/users`.
- **Profiles** (`lp_profiles`: `id`, `full_name`, `role`): `role ∈ {admin, customer}`. `getProfile()` cached; profil dibuat otomatis sebagai `customer` saat pertama diakses. `requireAdmin()` menjaga route admin.
- **Hanya admin** boleh buat/edit landing page & akses Dashboard/Users/Categories/Contacts/Inbox/Custom JS. Customer melihat pembelian, invoice, review.
- Role dinormalisasi case-insensitive via `lib/profile-utils.ts: normalizeRole()`.

> Flow buat & edit landing page (admin) ada di `app/panel/CLAUDE.md` — kebaca otomatis
> saat kerja di dalam `app/panel/`.

## Flow: render landing page publik (`/lp/[slug]`)

- `getPageBySlug()` ambil `html_content`, `preview_type`, `preview_url` (di-`cache()`). `generateMetadata()` bangun OG/canonical.
- Berdasarkan `preview_type`: `pdf`/`link` → `<iframe src=…>` (PDF pakai `#toolbar=0`); selain itu HTML dirender di dalam `<iframe srcDoc={guardPreviewHtml(html)}>` sandbox `allow-scripts allow-same-origin allow-modals`.
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

# Signup (bot protection — lib/signup-guard.ts)
SIGNUP_FORM_SECRET                 # opsional; HMAC token form (default: service role key)
NEXT_PUBLIC_TURNSTILE_SITE_KEY     # captcha Cloudflare Turnstile; kosong = captcha mati
TURNSTILE_SECRET_KEY               # pasangannya; keduanya wajib agar captcha aktif

# Meta / tracking
NEXT_PUBLIC_FB_PIXEL_ID
META_CAPI_ACCESS_TOKEN
META_CAPI_VERSION                  # default v21.0
```
(lihat `.env.example`, `.env.local`, `.env.development.local`)

## Catatan migration

- Migration berurutan timestamp di `supabase/migrations/`. Yang terbaru per Jun 2026: `category_parent`, `landing_assets_site_zip`, `pp_presence_owner`.
- Rangkaian `2026062100xx` adalah rename/merge tabel lama — perhatikan saat menyentuh nama tabel/kolom.
