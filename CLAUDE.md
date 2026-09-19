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
| Multi-domain, tema, palet, PWA per-domain | [`docs/multi-domain.md`](docs/multi-domain.md) + [`docs/technical.md`](docs/technical.md) |
| Template chat MbahGPT (+ backend-nya) | [`docs/mbahgpt.md`](docs/mbahgpt.md) |
| Setup, script, env, deploy | [`docs/technical.md`](docs/technical.md), [`.env.example`](.env.example) |
| Pitch produk (non-teknis) | [`README.md`](README.md) |
| Menjalankan & menguji di mesin lokal | skill [`run-local`](.claude/skills/run-local/SKILL.md) |
| Flow buat/edit produk (admin) | [`app/panel/CLAUDE.md`](app/panel/CLAUDE.md) |
| Laporan kampanye iklan | `docs/campaign-reports/` |
| Rencana berjalan (multi-fase) | `docs/plans/` — status tiap fase ada di dokumennya sendiri |
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

- **Middleware** (`middleware.ts`): refresh sesi Supabase tiap request. `/panel/*` butuh login (redirect ke `/login`); user login yang buka `/login`/`/signup` diarahkan ke `?next=` kalau ada, kalau tidak ke `/panel`.
- **`?next=` sesudah login**: tujuan setelah masuk, dipakai checkout, reader, dan storefront chat (`/login?next=/`). Nilainya **wajib** lewat `safeNextPath()` (`lib/next-path.ts`) — `startsWith("/")` saja meloloskan `//evil.example`, yang browser resolve ke origin lain.
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
- **Tiga jenis akun: Company → Agent → Customer.** Satu akun global (email unik
  se-project Supabase). Detail & riwayat keputusannya di
  [`docs/plans/hierarchical-users.md`](docs/plans/hierarchical-users.md).
  - **`lp_profiles.account_type`** = `company | agent | customer`. Jenis akunnya.
    Tidak ada `role` lagi di tabel ini, dan **publisher bukan jenis akun**.
  - **`lp_site_agents(site_id, user_id)`** = Agent mana mengelola situs mana.
    Satu situs boleh punya beberapa Agent.
  - **`lp_site_members(site_id, user_id, is_publisher, publisher_*)`** = customer
    situs itu. Tabel ini **tidak menyimpan role**. `is_publisher` = customer ini
    boleh menjual **di situs ini**; berkas KYC-nya ada di baris yang sama, jadi
    verifikasinya per storefront.
  - Company lintas situs dan tidak perlu baris di mana pun: dia yang membuat
    situsnya, dan mengunci dirinya di luar domain baru adalah cara bodoh
    kehilangan akses.
  - Izin dijawab satu tempat: `lib/site-membership.ts` (`canManageSite`,
    `canSellOnSite`) di atas `SiteStanding` — tiga fakta dari tiga tabel, sengaja
    tidak diringkas jadi satu "role". Meringkasnya itu yang dulu membuat
    "publisher" tersimpan di dua tempat sekaligus.
- **Empat gate, jangan tertukar** (`lib/actions/profiles.ts`):
  - `requireAdmin()` — Company. Untuk aksi yang **tidak boleh
    didelegasikan**: buat/hapus situs, hapus akun, ban, ubah role platform.
  - `requireSiteAdmin(siteId?)` — Agent situs itu (Company selalu lolos).
    Dipakai layar & action per-situs. **Wajib menerima `siteId` yang dikirim
    klien**, bukan situs yang kebetulan sedang dilihat.
  - `canSellProducts()` — Company & Agent, tanpa menyebut situs.
    `canSellOnCurrentSite(siteId)` versi per-situsnya, dan **itu yang dipakai
    untuk publisher** — izin jualnya terikat satu situs, jadi gate yang tidak
    menyebut situs tidak bisa menjawabnya.
  - `requireFeature(key)` — Company dan Agent selalu lolos; selain
    itu fitur harus diberikan ke role-nya di peta situs itu. Nav panel digambar
    dari `getAccessibleFeatures()`.
- **Delegasi fitur admin**: daftar fitur yang bisa diberikan ada di `lib/features.ts`
  (`ADMIN_FEATURES`: stats, users, categories, contacts, inbox, hero, content, legal,
  hiring, custom-js). Peta role→fitur disimpan di `lp_site_settings` key
  `role_permissions` (`lib/role-permissions.ts`), diedit di `/panel/roles`, dibaca
  lewat `getRolePermissions(siteId)` yang ter-cache (tag `role-permissions`).
  **Per-situs**, dengan baris kanonik sebagai cadangan — situs yang belum pernah
  mengaturnya tidak kehilangan delegasi hanya karena barisnya belum dibuat.
- **Publisher (KYC)**: user melamar di `/panel/publisher` — nama legal, foto KTP +
  selfie, alamat, rekening bank, persetujuan syarat — lalu `publisher_status`
  jadi `pending`. Status ditulis dengan service-role karena user tidak boleh menaikkan
  statusnya sendiri. Admin menyetujui/menolak (`lib/actions/admin.ts`); `approved`
  sekaligus menaikkan `role` jadi `publisher`. Status ∈ `{none, pending, approved,
  rejected}`. Skemanya di migration `20260729020000_publisher_kyc`,
  `20260730000000_publisher_identity_payout`, `20260730010000_publisher_address`.
- **Publisher hanya melihat miliknya sendiri**: pemisahan penjualan ada di
  `lib/actions/sales.ts` (satu read yang sudah di-scope per-role), **bukan** di
  halaman — supaya angka global tidak bisa diraih dengan merender komponen lain.
- Customer melihat pembelian, invoice, review.
- **Hapus user** (`DELETE /api/admin/users`, tombol di `/panel/users`): platform
  admin saja — beda dari **keluarkan dari situs** (`fromSite: true`) yang boleh
  dilakukan Agent dan hanya mencabut satu baris keanggotaan — ban itu kontrol yang bisa dibatalkan dan boleh didelegasikan, hapus tidak.
  Ditolak untuk: diri sendiri, akun ber-role admin (turunkan dulu), dan akun yang
  **masih punya produk** — `lp_landing_pages.user_id` cascade, jadi menghapus
  pemiliknya ikut menghapus katalog beserta filenya. Foto KTP/selfie di bucket
  `publisher-kyc` dihapus eksplisit (Storage tidak punya FK yang bisa cascade).
- **Menghapus user tidak menghapus uangnya.** `lp_purchases.user_id` dan
  `lp_plan_orders.user_id` sekarang **nullable + `ON DELETE SET NULL`**
  (migration `20260829000000`): baris penjualannya tetap ada tanpa nama, jadi omzet,
  jumlah penjualan, dan jejak invoice tidak berubah karena satu akun dihapus. Setiap
  pembaca `user_id` di dua tabel itu **wajib** tahan NULL — `lib/actions/sales.ts`
  dan `getStats`/`getCustomers` di `lib/actions/admin.ts` sudah.

> Flow buat & edit landing page (admin) ada di `app/panel/CLAUDE.md` — kebaca otomatis
> saat kerja di dalam `app/panel/`.

## Flow: render landing page publik (`/preview/[slug]`)

> **Rute ini pindah** dari `/lp/[slug]`. `next.config.ts` menyimpan redirect 308
> `/lp/:slug → /preview/:slug` — wajib, karena iklan yang jalan menunjuk ke URL lama.
> Preview juga **noindex** (lihat `docs/technical.md` → "Preview & SEO"), dan produk di sitemap
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
`id, user_id (FK auth.users, **nullable** — NULL = akunnya sudah dihapus), landing_page_id (FK lp_landing_pages), purchased_at, amount, payment_method, invoice_number (UNIQUE), UNIQUE(user_id, landing_page_id)`.

## Tracking & analytics

- `lib/analytics.ts`: helper gtag/fbq. Event: `view_item`, `begin_checkout`, `purchase`.
- **Dedup Meta**: pixel browser & CAPI server pakai `eventId = merchantOrderId` yang sama → 1 konversi. `PurchaseTracker` cek localStorage agar tak double-fire saat refresh.
- Script marketing diinject via `components/marketing-scripts.tsx`; custom JS global dari `lp_site_settings` (key `custom_js`) via panel Custom JS.
- **Tracking & live chat per-situs** (`lp_site_settings` key `tracking`, `lib/tracking-config.ts`, diedit di `/panel/tracking`): GTM container id + property/widget Tawk.to, masing-masing punya fallback env (`NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_TAWK_*`). ID Tawk **dulu di-hardcode** — artinya tiap storefront niche membuka chat support milik bisnis lain. Dua ID-nya disimpan sebagai pasangan: satu kosong = chat mati, karena setengah pasangan menghasilkan URL embed yang 404 diam-diam.
- `components/tawk-chat.tsx` menyembunyikan bubble di `/panel`, `/preview`, dan halaman depan template fullscreen — lewat `hideWidget()`, bukan dengan unmount: script Tawk menaruh iframe-nya sendiri di luar React, jadi unmount tidak menghapus apa pun.

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
- **Paket pengguna** (Free/Pro/Business/Enterprise + dua slot cadangan
  `tier5`/`tier6` yang dikirim tersembunyi): bawaan batasnya di
  `lib/plans.ts`, bisa ditimpa per-situs di `/panel/plans` (`lp_site_settings` key
  `plan_limits`) — baca lewat `resolvePlanLimits()`, jangan `PLANS[x].limits`.
  Nama tier, keterangannya, dan apakah ditampilkan ada di key `plan_meta` — baca
  lewat `resolvePlanMeta()`/`visiblePlanKeys()`, jangan `PLANS[x].label`.
  `plan_meta.enabled: false` mematikan seluruh penjualan tier di situs itu:
  `/upgrade` jadi 404 dan create-invoice menolak.
  Paket & masa aktif di `lp_profiles.plan` +
  `plan_expires_at`, harga per bulan per-situs di `lp_site_settings` key
  `plan_prices` (layar yang sama). Beli di `/upgrade` → `POST
  /api/plans/create-invoice` (order `PL_…` di `lp_plan_orders`) → callback Duitku
  yang sama dengan produk, dibedakan lewat prefix merchantOrderId. Ditegakkan di
  route chat (kuota harian, pencarian web, lampiran, riwayat) dan di
  `createLandingPage` (jumlah produk). Detail di [`docs/mbahgpt.md`](docs/mbahgpt.md).
- **Contacts** (`components/contact-form.tsx` → `lp_contacts`), dibaca admin di `/panel/contacts`.
- **Reviews** (`lp_reviews`), **categories** (`lp_landing_page_categories`, hierarki via `parent_id`), **site settings** (`lp_site_settings`).
- SEO: `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, `lib/seo.ts`, JSON-LD Organization di `app/layout.tsx`.

## Environment variables

Sumber tunggal: [`.env.example`](.env.example) — tiap variabel ada komentarnya di
sana. Daftarnya **tidak** diduplikasi di sini; salinan pasti menyimpang (pernah
terjadi: dokumen menyebut variabel yang sudah tidak dibaca kode, sementara variabel
wajib tidak tercatat sama sekali).

## Catatan migration

- Migration berurutan timestamp di `supabase/migrations/`. **Jangan menyalin daftar
  "yang terbaru" ke dokumen ini** — salinannya pasti basi (pernah tertinggal dua
  bulan); `ls supabase/migrations | tail` yang benar.
- Rangkaian `2026062100xx` adalah rename/merge tabel lama — perhatikan saat menyentuh nama tabel/kolom.
