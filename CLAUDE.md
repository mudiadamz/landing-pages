# CLAUDE.md — Landing Page Manager (ADM.UIUX)

Marketplace produk digital milik ADM.UIUX (Adam Mudianto). Admin membuat & menjual
produk; pembeli preview gratis, bayar via Duitku, lalu download atau baca di situs.
**Satu deployment melayani beberapa storefront** (multi-domain + tema).

## Baca ini dulu

Aturan yang mengatur codebase ini — batas antar lapisan, invarian, pola untuk
menambah sesuatu, dan jebakan strukturalnya — ada di
**[`docs/architecture.md`](docs/architecture.md)**.

Dokumen itu yang menentukan *bagaimana* menambah sesuatu. File ini cuma inventaris
*apa* yang sudah ada. Kalau keduanya bertabrakan, `docs/architecture.md` yang benar,
dan file ini yang perlu diperbarui.

Ringkasan yang paling sering dilanggar:

1. **Fungsi ter-cache tidak boleh membaca `headers()`/`cookies()`.** Identitas
   tenant di-resolve di luar cache dan dikirim sebagai argumen.
2. **Invalidasi `unstable_cache` pakai `revalidateTag(tag, "max")`**, bukan
   `updateTag` sendirian.
3. **Presentasi tidak mengambil data.** Halaman fetch, tema merender.
4. **Modul `"use server"` hanya export `async function`.**
5. **Service-role client bypass RLS** — setiap pemakaian wajib punya gate
   otorisasi sendiri (`requireAdmin`/`requireFeature`/cek kepemilikan).
6. **Konten berbayar dipotong di server**, bukan disembunyikan di client.

## Peta

| Mau apa | Ke mana |
|---|---|
| Aturan & pola arsitektur | [`docs/architecture.md`](docs/architecture.md) |
| Multi-domain, tema, palet | [`docs/multi-domain.md`](docs/multi-domain.md) + README |
| Template chat MbahGPT (+ backend-nya) | [`docs/mbahgpt.md`](docs/mbahgpt.md) |
| Setup, script, env | [`README.md`](README.md), [`.env.example`](.env.example) |
| Flow buat/edit produk (admin) | [`app/panel/CLAUDE.md`](app/panel/CLAUDE.md) |
| Laporan kampanye iklan | `docs/campaign-reports/` |
| Sisa string hardcode (i18n) | [`docs/i18n-backlog.md`](docs/i18n-backlog.md) — regen: `npm run i18n:scan` |

## Konvensi penting

- Semua tabel app diawali prefix **`lp_`** (mis. `lp_landing_pages`, `lp_purchases`,
  `lp_sites`). Tabel lama pernah di-rename → lihat migration `2026062100xx_*`.
- Bahasa UI: **Indonesia** (`<html lang="id">`, locale `id_ID`).
- Tiga Supabase client di `lib/supabase/`:
  - `server.ts` — server components/actions, cookie-based, **terkena RLS**.
  - `client.ts` — browser.
  - `admin.ts` — Service Role Key, **bypass RLS**. Boleh di luar API route, tapi
    pemakaiannya wajib punya gate otorisasi sendiri.
  - Catatan: client cookie-based **tidak bisa** dipakai di dalam `unstable_cache`.
- **Semua input file di panel WAJIB `FileUploadCard`** (`components/file-upload-card.tsx`).
  Jangan `<input type="file">` telanjang: kartu itu yang memegang state kosong/terisi,
  nama + ukuran, tombol ganti/hapus, dan error. Dulu privat di `product-edit-form.tsx`,
  lalu layar lain menumbuhkan input sendiri yang bentuknya beda.
- Server Actions semua di `lib/actions/*.ts`.
- Kontak support hardcode di `lib/constants.ts` (`SUPPORT_CONTACT`).
- Selesai task → **commit** tanpa diminta. **Jangan `git push`** — diblokir di
  settings (deny rule + PreToolUse hook), termasuk kalau diselipkan di rantai `&&`.
  Adam yang push. (`.cursor/rules/commit-push-after-finish.mdc` masih menyebut push —
  itu untuk Cursor.)

## Auth & roles

- **Middleware** (`middleware.ts`): refresh sesi Supabase tiap request. `/panel/*` butuh login (redirect ke `/login`); user login yang buka `/login`/`/signup` diarahkan ke `/panel`.
- **Sign-in**: email/password (`lib/actions/auth.ts: login`) atau Google OAuth (`signInWithGoogle` → `/auth/callback` `exchangeCodeForSession`).
- **OAuth di domain non-kanonik**: Supabase hanya kenal satu redirect URL, jadi login
  dari storefront lain kembali ke callback kanonik dengan `?sf=<host>`, lalu callback
  itu **meneruskan `code`-nya** ke `/auth/callback` domain asal — bukan menukarnya di
  situ, karena verifier PKCE-nya cookie milik domain asal. Aturan & penjagaannya di
  `lib/oauth-return.ts`; `?sf=` **wajib** divalidasi terhadap `lp_sites`. Konsekuensi:
  menambah domain tidak perlu menyentuh dashboard Supabase sama sekali.
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

## Flow: render landing page publik (`/preview/[slug]`)

> **Rute ini pindah** dari `/lp/[slug]`. `next.config.ts` menyimpan redirect 308
> `/lp/:slug → /preview/:slug` — wajib, karena iklan yang jalan menunjuk ke URL lama.
> Preview juga **noindex** (lihat README → "Preview & SEO"), dan produk di sitemap
> menunjuk `/checkout/[slug]`.

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

- **Hiring** (`/hiring`, `/hiring/test`): iklan lowongan + soal situasional, keduanya
  **data per-situs** di `lp_site_settings` key `hiring_content` (`lib/hiring-config.ts`),
  diedit di `/panel/hiring`. `enabled: false` → kedua route 404 dan link footer hilang.
  Upload CV PDF (≤5MB): `POST /api/hiring-test` upload ke bucket `hiring-cv` (admin
  client), **menilai jawaban dari DB** (indeks jawaban benar tidak pernah dikirim ke
  browser pelamar), lalu email hasil via Resend.
- **Halaman legal** (`/privacy`, `/terms`, `/refund`): satu renderer
  (`components/legal-page-view.tsx`) di atas `lp_site_settings` key `legal_content`
  (`lib/legal-config.ts`), diedit di `/panel/legal`. Body HTML, disanitasi saat simpan
  (`lib/page-html.ts`), dirender di `.page-prose`. URL-nya tetap — beda dari halaman
  editorial `lp_pages` yang slug-nya dibuat orang.
- **Inbound email** (`/api/webhooks/resend/inbound`): Resend kirim event `email.received` (verifikasi svix). Disimpan ke `lp_received_emails`, dibaca di panel Inbox. Butuh `RESEND_WEBHOOK_SECRET`.
- **MbahGPT** (template `mbahgpt`): storefront yang halaman depannya adalah chatbox
  ke model OpenRouter. Tabel `lp_chat_*`, inti di `lib/mbahgpt/`, streaming lewat
  `app/api/mbahgpt/chat`. Mati sendiri (halaman bilang "belum aktif") kalau
  `OPENROUTER_API_KEY` kosong. Detail & batasannya di [`docs/mbahgpt.md`](docs/mbahgpt.md).
- **Contacts** (`components/contact-form.tsx` → `lp_contacts`), dibaca admin di `/panel/contacts`.
- **Reviews** (`lp_reviews`), **categories** (`lp_landing_page_categories`, hierarki via `parent_id`), **site settings** (`lp_site_settings`).
- SEO: `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, `lib/seo.ts`, JSON-LD Organization di `app/layout.tsx`.

## Environment variables

Sumber tunggal: [`.env.example`](.env.example) — tiap variabel ada komentarnya di
sana. Daftarnya **tidak** diduplikasi di sini; salinan pasti menyimpang (pernah
terjadi: dokumen menyebut variabel yang sudah tidak dibaca kode, sementara variabel
wajib tidak tercatat sama sekali).

## Catatan migration

- Migration berurutan timestamp di `supabase/migrations/`. Yang terbaru per Jun 2026: `category_parent`, `landing_assets_site_zip`, `pp_presence_owner`.
- Rangkaian `2026062100xx` adalah rename/merge tabel lama — perhatikan saat menyentuh nama tabel/kolom.
