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
| Setup, script, env | [`docs/technical.md`](docs/technical.md), [`.env.example`](.env.example) |
| Deploy (Docker + Caddy) | [`docs/technical.md`](docs/technical.md) → Deploy, `Dockerfile`, `docker-compose.yml`, `Caddyfile` |
| Pitch produk (non-teknis) | [`README.md`](README.md) |
| Menjalankan & menguji di mesin lokal | skill [`run-local`](.claude/skills/run-local/SKILL.md) |
| Flow buat/edit produk (admin) | [`app/panel/CLAUDE.md`](app/panel/CLAUDE.md) |
| Laporan kampanye iklan | `docs/campaign-reports/` |
| Rencana berjalan (multi-fase) | `docs/plans/` — status tiap fase ada di dokumennya sendiri |
| Tes database, RLS, auth, storage | `tests/db/` (`pnpm test:db`, butuh `pnpm db:up`) |
| Cutover dari Supabase (sekali, tugas Adam) | [`docs/runbooks/cutover-supabase.md`](docs/runbooks/cutover-supabase.md) |
| Sisa string hardcode (i18n) | [`docs/i18n-backlog.md`](docs/i18n-backlog.md) — regen: `pnpm i18n:scan` |

## Konvensi penting

- Semua tabel app diawali prefix **`lp_`** (mis. `lp_landing_pages`, `lp_purchases`,
  `lp_sites`). Tabel lama pernah di-rename → lihat `db/migrations/_archive/2026062100xx_*`.
- Bahasa UI: **Indonesia** (`<html lang="id">`, locale `id_ID`).
- Client di `lib/db/` — bentuk API-nya meniru supabase-js (`.from().select().eq()`,
  `.storage.from()`, `.auth.getUser()`), di baliknya SQL langsung ke Postgres lewat
  `lib/backend/`:
  - `server.ts` — server components/actions, sebagai user dari cookie sesi, **terkena RLS**.
  - `anon.ts` — sebagai `anon`, untuk bacaan publik (boleh di dalam cache).
  - `client.ts` — browser; hanya `.storage` (lewat route sendiri) dan `.auth.getUser()`.
  - `admin.ts` — role `service_role`, **bypass RLS**. Boleh di luar API route, tapi
    pemakaiannya wajib punya gate otorisasi sendiri.
  - Catatan: client cookie-based **tidak bisa** dipakai di dalam `unstable_cache`.
- **Semua input file di panel WAJIB `FileUploadCard`** (`components/file-upload-card.tsx`).
  Jangan `<input type="file">` telanjang: kartu itu yang memegang state kosong/terisi,
  nama + ukuran, tombol ganti/hapus, dan error. Dulu privat di `product-edit-form.tsx`,
  lalu layar lain menumbuhkan input sendiri yang bentuknya beda.
- **Manajer paketnya pnpm**, versinya dipatok di `packageManager`. `npm install`
  sengaja gagal (`scripts/only-pnpm.mjs`) — bukan soal selera: pin keamanan ada
  di `pnpm-workspace.yaml` yang tidak dibaca npm, dan node_modules npm yang
  di-hoist menyembunyikan dependency yang tidak pernah dideklarasikan.
  - Setelan pnpm (`overrides`, `allowBuilds`) ada di **`pnpm-workspace.yaml`**,
    bukan field `pnpm` di package.json — sejak pnpm 10 yang di package.json
    diabaikan diam-diam.
  - `allowBuilds` harus menjawab **setiap** install script dependency, termasuk
    yang ditolak; install gagal selama masih ada yang belum diputuskan.
- **Dua suite tes.** `pnpm test` murni — jalan tanpa Docker. `pnpm test:db` butuh
  satu container Postgres (`pnpm db:up`, `compose.dev.yml`), membangun database
  `lp_test` dari nol lewat `db/migrations` setiap kali jalan, dan menguji
  database, RLS, grant, auth, dan storage yang sungguhan. Kode yang diuji
  tersambung sebagai role `app` — hak yang sama persis dengan produksi, jadi grant
  yang kurang ketahuan di sini. **Jalankan `pnpm test:db` setelah setiap
  migration** — suite murni tetap hijau waktu seluruh pendaftaran akun patah.
  - **Policy harus sama dengan gerbang aplikasinya.** Aksi yang menggerbang
    dengan `requireSiteAdmin`/`requireFeature` lalu menulis lewat client user
    butuh policy yang meloloskan orang yang sama — kalau tidak, layar itu gagal
    untuk orang yang dibuatkan layarnya. Kalau lebih longgar, gerbang aplikasi
    jadi satu-satunya penjaga. (Dulu satu panggilan PostgREST dari browser
    melewatinya; jalan itu sudah tidak ada, tapi policy tetap lapis kedua.)
  - **Grant kolom `lp_profiles` & `lp_landing_pages` adalah DAFTAR.** Kolom baru
    tidak otomatis bisa ditulis user; putuskan, grant, dan perbarui daftar di
    tesnya. (`avatar_url` gagal diam-diam sebulan karena ini.)
  - Tabel `lp_` baru: RLS menyala, lalu policy **atau** masuk daftar
    deny-all di `tests/db/rls-private.test.ts`. Snapshot permukaan keamanan
    (`tests/db/__snapshots__/rls-surface…`) hanya diperbarui dengan sadar (`-u`).
  - Tidak ada generated type — `tests/db/schema-contract.test.ts` yang memastikan
    setiap kolom yang disebut kode memang ada.
- Server Actions semua di `lib/actions/*.ts`.
- Kontak support hardcode di `lib/constants.ts` (`SUPPORT_CONTACT`).
- **Deploy: Docker, bukan Vercel lagi — dan tanpa Supabase.** `docker compose
  --env-file .env.production up -d --build` di server: `db` (postgres:17) →
  `migrate` (sekali jalan, sebagai pemilik) → `app` (sebagai role `app`) → Caddy.
  Backup: `scripts/backup.sh` dari cron; latihan restore: `scripts/restore-drill.sh`.
  Caddy di depan mengurus TLS untuk semua domain lewat
  on-demand TLS, dan bertanya ke `/api/tls-check` (jawabannya dari `lp_sites`)
  sebelum menerbitkan sertifikat. `NEXT_PUBLIC_*` disulih saat **build** — ganti
  nilainya berarti build ulang, bukan restart.
- **Selesai mengubah kode → jalankan rutin `scripts/ship.sh "pesan"`** (sejak
  2026-09-22, permintaan Adam): (1) naikkan versi, (2) rebuild + restart, (3)
  commit + push — tanpa diminta lagi tiap selesai. Ketiganya sudah otomatis:
  versi dinaikkan oleh hook `.githooks/pre-commit`; rebuild/restart oleh
  `scripts/redeploy.sh` (REBUILD/RESTART/NOOP sesuai yang berubah); push ke
  `origin` (allow rule `Bash(git push:*)` di `~/.claude/settings.json`) dengan
  retry. Push butuh kredensial GitHub (gh auth / PAT / SSH) yang harus disiapkan
  sekali di mesin ini. Aturan lama "push hanya kalau diminta" **diganti** oleh
  rutin ini.
- **Author commit selalu Adam, bukan Claude.** Commit pakai
  `git -c user.email=mudi.adamz@gmail.com -c user.name=mudiadamz` (Vercel dulu
  menolak email lain — lihat memory), dan **tanpa trailer `Co-Authored-By:
  Claude…`**. Ditegakkan di `~/.claude/settings.json` lewat
  `attribution.commit: ""` dan `attribution.pr: ""`, jadi berlaku di semua repo,
  bukan cuma yang ini.

## Auth & roles

- **Proxy** (`proxy.ts` → `lib/db/proxy.ts`, runtime Node): memvalidasi sesi di `/panel`, `/read`, `/login`, `/signup` saja. `/panel/*` butuh login (redirect ke `/login`); user login yang buka `/login`/`/signup` diarahkan ke `?next=` kalau ada, kalau tidak ke `/panel`.
- **`?next=` sesudah login**: tujuan setelah masuk, dipakai checkout, reader, dan storefront chat (`/login?next=/`). Nilainya **wajib** lewat `safeNextPath()` (`lib/next-path.ts`) — `startsWith("/")` saja meloloskan `//evil.example`, yang browser resolve ke origin lain.
- **Auth milik sendiri, bukan GoTrue** (`lib/backend/auth.ts`, sejak fase 3
  `docs/plans/remove-supabase.md`). User tetap di `auth.users` (hash bcrypt GoTrue
  dipakai apa adanya); sesi = token opak di cookie httpOnly `lp_session` /
  `__Host-lp_session`, disimpan sebagai sha256 di `app_auth.sessions`. **Jangan pernah
  menentukan identitas dari hal lain** — `currentUser()` (`lib/auth/session.ts`) atau
  `db.auth.getUser()` dari `lib/db/server` (bentuk lama, jawaban sama). Ban (`setBanned`) mencabut
  semua sesi saat itu juga.
- **Sign-in**: email/password (`lib/actions/auth.ts: login`, batas gagal per IP & per
  email) atau Google (`signInWithGoogle` → `lib/backend/google.ts`, OAuth+PKCE tanpa
  SDK → `/auth/callback`). Env: `GOOGLE_CLIENT_ID/SECRET`.
- **OAuth di domain non-kanonik**: Google hanya kenal satu redirect URI, jadi login
  dari storefront lain kembali ke callback kanonik dengan host asal di dalam `state`, lalu callback
  itu **meneruskan `code`-nya** ke `/auth/callback` domain asal — bukan menukarnya di
  situ, karena verifier PKCE-nya cookie milik domain asal. Aturan & penjagaannya di
  `lib/oauth-return.ts`; host itu **wajib** divalidasi terhadap `lp_sites`, dan
  `state` diperiksa terhadap cookie browser itu. Konsekuensi: menambah domain tidak
  perlu menyentuh Google Cloud Console sama sekali.
- **Verifikasi email**: signup **tidak** menunggu verifikasi — akun langsung
  `email_confirmed_at`, yang cuma berarti "boleh login". Bukti kepemilikan alamat ada di `lp_profiles.email_verified_at`, diisi lewat
  email Resend sendiri (`lib/email-verify.ts` → `/auth/verify-email`, token HMAC 24 jam).
  Signup Google langsung terverifikasi (lihat trigger `lp_handle_new_user`). Selama belum
  verified, `EmailConfirmBanner` selalu tampil di `/panel`; admin melihat statusnya +
  filter "Belum verifikasi" di `/panel/users`.
- **Kedudukan: Platform, lalu peran di sebuah Business.** `lp_profiles.account_type`
  **sudah tidak ada** (pensiun di Fase 5,
  [`docs/plans/multi-business-saas.md`](docs/plans/multi-business-saas.md); model
  lamanya & riwayat keputusannya di
  [`docs/plans/hierarchical-users.md`](docs/plans/hierarchical-users.md)). Satu
  jenis akun global tidak bisa menjawab pertanyaan yang sebenarnya ditanyakan
  tiap layar — "boleh apa dia DI SINI" — dan begitu ada business kedua, setiap
  "Agent" jadi Agent di semua business sekaligus.
  - **`lp_profiles.is_platform`** = operator SaaS-nya. Menggantikan "Company".
  - **`lp_business_members(business_id, user_id, role)`** = `owner | admin | staff`,
    **per business**. Menggantikan "Agent".
  - Tidak dua-duanya = pembeli biasa. Menggantikan "Customer".
  - **`lp_site_agents(site_id, user_id)`** = delegasi PER SITUS di dalam sebuah
    business. Tetap ada; satu situs boleh punya beberapa Agent.
  - **`lp_site_members(site_id, user_id, is_publisher, publisher_*)`** = customer
    situs itu. Tabel ini **tidak menyimpan role**. `is_publisher` = customer ini
    boleh menjual **di situs ini**; berkas KYC-nya ada di baris yang sama, jadi
    verifikasinya per storefront. **Publisher tetap bukan jenis akun.**
  - Platform lintas situs dan tidak perlu baris di mana pun: dia yang membuat
    situsnya, dan mengunci dirinya di luar domain baru adalah cara bodoh
    kehilangan akses.
  - Izin dijawab satu tempat: `lib/site-membership.ts` (`canManageSite`,
    `canSellOnSite`) di atas `SiteStanding` — **empat** fakta dari empat tabel,
    sengaja tidak diringkas jadi satu "role". Meringkasnya itu yang dulu membuat
    "publisher" tersimpan di dua tempat sekaligus.
  - **`SiteStanding.businessRole` selalu peran di business PEMILIK SITUS INI**,
    bukan peran global si pemanggil. Owner sebuah business bukan siapa-siapa di
    storefront orang lain, dan itu seluruh alasan Fase 5 ada.
  - Di database, `lp_get_my_profile_role()` masih mengembalikan
    `company | agent | customer` — sebelas policy memanggilnya — tapi sejak Fase 5
    nilainya **diturunkan** (`is_platform` → company, owner/admin → agent, sisanya
    customer), bukan dibaca dari kolom.
- **Empat gate, jangan tertukar** (`lib/actions/profiles.ts`):
  - `requireAdmin()` / `requirePlatform()` — Platform. Untuk aksi yang **tidak
    boleh didelegasikan**: buat/hapus situs, hapus akun, ban, angkat operator
    Platform. Keduanya menanyakan hal yang sama; dua nama karena pemanggilnya
    menyebut niat yang berbeda.
  - `requireSiteAdmin(siteId?)` — owner/admin business pemilik situs itu, atau
    Agent situs itu (Platform selalu lolos). **Wajib menerima `siteId` yang
    dikirim klien**, bukan situs yang kebetulan sedang dilihat.
  - `canSellProducts()` — Platform & anggota business mana pun (staff ikut:
    menjual memang pekerjaannya), tanpa menyebut situs.
    `canSellOnCurrentSite(siteId)` versi per-situsnya, dan **itu yang dipakai
    untuk publisher** — izin jualnya terikat satu situs, jadi gate yang tidak
    menyebut situs tidak bisa menjawabnya.
  - `requireFeature(key)` — **gabungan** dari tiap jalan masuk yang dia punya,
    bukan yang pertama cocok: Platform & owner selalu lolos, admin/staff lewat
    matriks business, Agent situs itu lolos, sisanya lewat matriks situs. Ambil
    yang pertama cocok dan menambah peran bisa MENGURANGI izin. Nav panel
    digambar dari `getAccessibleFeatures()`.
- **Dua shell panel, satu set route.** `/panel` melayani dua audiens yang nyaris
  tidak beririsan: business menjangkau 26 layar, customer menjangkau empat. Jadi
  yang bercabang **shell-nya**, bukan route-nya — halaman yang sama dirender di
  bingkai yang cocok, tidak ada yang dipindah atau diduplikasi.
  - Aturannya di `lib/panel-shell.ts` (`isCustomerOnly`), dipakai sekali di
    `app/panel/layout.tsx`. Ditulis sebagai daftar hal yang **tidak** bisa dia
    lakukan: bukan Platform, tanpa peran business, tidak boleh jual di situs ini
    (itu mencakup publisher & Agent situs), dan nol fitur terdelegasi. **Satu
    kemampuan saja sudah cukup untuk tetap dapat sidebar** — salah ke arah itu
    cuma memalukan, salah ke arah sebaliknya mencabut menu yang kemarin ada.
  - Customer → `components/account-shell.tsx`: topbar + empat tab
    (`components/account-nav.tsx`), bottom bar di HP. Tanpa sidebar.
  - **Sengaja bukan chrome storefront**: chrome itu per-template (default /
    linkbio / mbahgpt / pustaka), jadi "pembelian saya" akan tampak jadi empat
    halaman berbeda tergantung domain tempat dia beli.
  - `PanelTopbar` dipakai kedua shell lewat `withSidebar` — satu menu akun, bukan
    dua yang harus disamakan. "Daftar business" jadi satu baris di menu itu
    (`canApplyBusiness`), supaya tetap terjangkau dari layar mana pun tanpa jadi
    tab kelima.
- **Delegasi fitur admin**: daftar fitur yang bisa diberikan ada di `lib/features.ts`
  (`ADMIN_FEATURES`: stats, users, categories, contacts, inbox, hero, content, legal,
  hiring, custom-js). **Dua matriks, dua sumbu, sengaja tidak digabung**
  (`lib/role-permissions.ts`, keduanya diedit di `/panel/roles`):
  - **per SITUS** — `customer | publisher`, di `lp_site_settings` key
    `role_permissions`, dibaca lewat `getRolePermissions(siteId)` yang ter-cache
    (tag `role-permissions`). Dengan baris kanonik sebagai cadangan, jadi situs
    yang belum pernah mengaturnya tidak kehilangan delegasi.
  - **per BUSINESS** — `admin | staff`, di kolom `lp_businesses.role_permissions`,
    dibaca lewat `getBusinessRolePermissions()`. Owner tidak ada di matriksnya:
    owner yang bisa dikunci dari business-nya sendiri itu tiket support, bukan
    fitur. Default (belum pernah diatur) = admin semuanya, staff kosong — persis
    yang dipunya Agent sebelum Fase 5.
- **Publisher (KYC)**: user melamar di `/panel/publisher` — nama legal, foto KTP +
  selfie, alamat, rekening bank, persetujuan syarat — lalu
  `lp_site_members.publisher_status` **situs itu** jadi `pending`. Ditulis dengan
  service-role karena user tidak boleh menaikkan statusnya sendiri. Admin
  menyetujui/menolak (`lib/actions/admin.ts`); `approved` menyalakan
  `lp_site_members.is_publisher` untuk situs itu — **bukan** mengubah jenis akun.
  Status ∈ `{none, pending, approved, rejected}`. Semua kolom `publisher_*` ada di
  `lp_site_members` sejak `20260903000000`; di `lp_profiles` sudah tidak ada.
- **Publisher hanya melihat miliknya sendiri**: pemisahan penjualan ada di
  `lib/actions/sales.ts` (satu read yang sudah di-scope per-role), **bukan** di
  halaman — supaya angka global tidak bisa diraih dengan merender komponen lain.
- Customer melihat pembelian, invoice, review.
- **Hapus user** (`DELETE /api/admin/users`, tombol di `/panel/users`): Platform
  saja — beda dari **keluarkan dari situs** (`fromSite: true`) yang boleh
  dilakukan pengelola situs dan hanya mencabut satu baris keanggotaan — ban itu kontrol yang bisa dibatalkan dan boleh didelegasikan, hapus tidak.
  Ditolak untuk: diri sendiri, akun Platform (cabut statusnya dulu), dan akun yang
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
  • URL bertanda HMAC (lib/backend/storage.ts, 1 jam) → redirect
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

- Migration berurutan timestamp di `db/migrations/`, diterapkan `pnpm db:migrate`
  (`scripts/migrate.mjs`; di server: service `migrate`). Dimulai dari
  `00000000000000_baseline.sql` — seluruh skema per 2026-09-22 plus shim (role
  `anon`/`authenticated`/`service_role`/`app`, `auth.uid()`). **Migration yang sudah
  jalan tidak boleh diubah** — runner menyimpan checksum dan menolaknya. **Jangan
  menyalin daftar "yang terbaru" ke dokumen ini**; `ls db/migrations | tail` yang benar.
- Riwayat sebelum baseline (91 migration era Supabase) ada di
  `db/migrations/_archive/` — hanya bacaan; rangkaian `2026062100xx` di sana adalah
  rename/merge tabel lama.
- Tabel/skema baru yang dibaca aplikasi **tanpa** berganti role (seperti
  `app_auth`) butuh grant ke `app` **dan** policy `to app` kalau RLS menyala —
  `app` bukan pemilik dan tidak BYPASSRLS.
