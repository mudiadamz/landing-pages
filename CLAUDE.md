# CLAUDE.md — Landing Page Manager (ADM.UIUX)

Marketplace milik ADM.UIUX (Adam Mudianto), terbuka untuk segala jenis bisnis —
barang fisik, produk digital, jasa, maupun langganan. Admin membuat & menjual
produk; pembeli preview gratis, bayar via Duitku, lalu mengakses pembeliannya —
download, baca di situs, atau ditindaklanjuti penjual.
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
| Template blog (URL ala Blogger) + impor Blogger | [`docs/blog.md`](docs/blog.md) |
| Domain pelanggan sendiri (root & subdomain, verifikasi TXT, sertifikat) | [`docs/runbooks/custom-domains.md`](docs/runbooks/custom-domains.md) |
| Setup, script, env | [`docs/technical.md`](docs/technical.md), [`.env.example`](.env.example) |
| Deploy (Cloudflare Tunnel + systemd — lihat "Konvensi penting") | `/etc/cloudflared/config.yml`, `scripts/redeploy.sh`. `Dockerfile`/`docker-compose.yml`/`Caddyfile` = jalur lama, tidak dipakai |
| Terminal browser untuk mesin produksi | `~/work/web-ssh` → `https://term.mbahgpt.com` |
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
- **Deploy — YANG SEBENARNYA JALAN (diperiksa 2026-09-23).** Produksi
  `mbahgpt.com` dilayani dari **mesin ini** (WSL2, `DESKTOP-1SAP3QS`) lewat
  **Cloudflare Tunnel**, bukan Docker dan bukan Caddy:

  ```
  Browser ──https──> Cloudflare ──tunnel──> cloudflared ──> localhost:3000
  ```

  - `/etc/cloudflared/config.yml` — ingress: `mbahgpt.com` & `www` → `:3000`,
    `term.mbahgpt.com` → `:8022` (web-ssh, lihat `~/work/web-ssh`),
    `ssh.mbahgpt.com` → `ssh://localhost:22`. **Catch-all 404 wajib terakhir** —
    cloudflared mencocokkan rule berurutan.
  - Aplikasinya **systemd**, bukan container: `landing-pages.service`. Itu yang
    di-restart `scripts/redeploy.sh`, dan itu sebabnya `scripts/ship.sh` bekerja.
  - **Databasenya lokal** di `127.0.0.1:54329` (container postgres `lp-dev-db-1`).
    `.env.development.local` menunjuk ke sana, jadi **DATABASE ITU PRODUKSI** —
    `pnpm db:migrate` dan tiap query di sesi dev mengenai data pengguna sungguhan.
    Perlakukan begitu.
  - `caddy.service` **inactive**. `Caddyfile` + `docker-compose.yml` di repo
    adalah jalur deploy lama (masih menunjuk service `app:3000`); jangan diikuti
    tanpa memastikan dulu, dan jangan dihapus tanpa keputusan sadar.
  - Konsekuensi TLS: sertifikat diurus Cloudflare, **bukan** on-demand TLS Caddy.
    `/api/tls-check` masih ada dan masih menjawab dari `lp_sites`, tapi di
    topologi ini tidak ada yang memanggilnya.
  - Backup: `scripts/backup.sh` dari cron; latihan restore: `scripts/restore-drill.sh`.
  - `NEXT_PUBLIC_*` disulih saat **build** — ganti nilainya berarti build ulang,
    bukan restart.
- **Selesai mengubah kode → jalankan rutin `scripts/ship.sh "pesan"`** (sejak
  2026-09-22, permintaan Adam): (0) **tolak kalau database tertinggal dari
  `db/migrations`**, (1) naikkan versi, (2) rebuild + restart, (3)
  commit + push — tanpa diminta lagi tiap selesai.
  - **Gerbang migration** (`pnpm db:check` → `scripts/migrate.mjs --check`)
    jalan PALING AWAL, sebelum kode baru mulai melayani. Ada karena 2026-09-23
    sebuah fase ter-ship padahal migration-nya belum pernah diterapkan di sini:
    produksi menjalankan kode baru di atas skema lama selama tujuh jam **tanpa
    satu error pun** — gagalnya baru muncul sebagai 500 di request pertama yang
    menyentuh kolom baru, bukan sebagai deploy yang patah.
  - Sengaja **menolak**, bukan menerapkan sendiri: sebuah migration bisa
    men-drop kolom, dan satu-satunya hal yang lebih buruk daripada ship tanpa
    migration adalah skrip deploy yang diam-diam menjalankan statement
    destruktif di produksi karena ada file baru muncul.
  - `SKIP_MIGRATE_CHECK=1` untuk menembusnya — gerbang yang tidak bisa dilewati
    saat darurat akan dihapus orang, bukan dipakai. Ketiganya sudah otomatis:
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
- **Umur sesi: 30 hari yang MENGGESER** (`SESSION_TTL_DAYS`), plus cookie 400 hari
  (`COOKIE_MAX_AGE`). Tiap request yang datang >24 jam sesudah `last_seen_at`
  mendorong `expires_at` jadi 30 hari lagi, jadi orang yang rutin buka situs tidak
  pernah kedaluwarsa. Cookie sengaja jauh lebih panjang dari barisnya: yang
  memutuskan hidup-matinya sesi adalah baris di `app_auth.sessions`, dan cookie
  yang hidup lebih lama dari barisnya cuma token yang tidak dikenal.
- **"Kok saya sering ke-logout?" — jangan menebak, baca lognya.** Setiap penyebab
  menghasilkan redirect ke `/login` yang identik, jadi proxy mencatat alasannya
  (`lib/db/proxy.ts` → `sessionFailureReason`, satu query dan HANYA di jalur gagal):
  - `no-cookie` — browser tidak mengirim apa pun. Barisnya bisa jadi masih hidup;
    cookie-nya yang hilang (dibersihkan, di-evict, private browsing, PWA iOS yang
    punya jar sendiri). **Menaikkan `SESSION_TTL_DAYS` tidak akan menolong sama
    sekali** — ini satu-satunya alasan orang paling sering salah tebak.
  - `unknown` — token sampai tapi tidak ada barisnya: sign-out di tempat lain, ban
    yang mencabut semua sesi, atau database yang berbeda.
  - `expired` — barisnya ada dan 30 harinya habis. Cuma ini yang bisa diperbaiki
    dengan menaikkan TTL.
  - `locked` — akun di-ban atau dihapus.
  Lognya memuat sidik jari sesi (8 hex dari sha256), bukan tokennya — cukup untuk
  mengaitkan dua baris log, tidak cukup untuk dipakai masuk. Lihat
  `tests/db/session-failure.test.ts`.
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
- **EMPAT kedudukan, tidak lebih** (permintaan Adam, 2026-09-23):
  | kedudukan | di database |
  |---|---|
  | **Platform** | `lp_profiles.is_platform` |
  | **Business** | `lp_business_members.role = 'business'` — orang yang MERUPAKAN business itu |
  | **Staff** | `lp_business_members.role = 'staff'` — sub-akun business itu |
  | **Customer** | bukan keduanya |
  - **`lp_site_members`** = pembeli sebuah situs. Tidak menyimpan role dan tidak
    lagi menyimpan izin jual.
  - **Yang DIHAPUS**, dan kenapa: `account_type` global (Fase 5), lalu
    **publisher** (`is_publisher` + berkas KYC-nya) dan **Agent situs**
    (`lp_site_agents`) — keduanya menjawab hal yang sama ("boleh jualan /
    mengurus di situs ini") lewat tabel sendiri-sendiri, dan sejak ada
    pendaftaran Business (Fase 4) pertanyaan itu punya satu jawaban: daftarkan
    business-nya, lalu ajak orangnya sebagai staff. Peran `admin` ikut pergi —
    yang tersisa **business** (mengatur) dan staff (bekerja). Peran itu bernama
    `owner` sampai 2026-09-24; diganti karena "owner" tidak mengatakan pemilik
    dari apa (migration `20260924050000`).
  - Konsekuensi yang disengaja: perorangan **tidak lagi "dinaikkan jadi penjual"**
    di satu storefront. Dia mendaftarkan Business, yang memang sudah punya KYC,
    ledger, dan payout sendiri. Bucket `publisher-kyc` ikut pensiun.
  - Izin dijawab satu tempat: `lib/site-membership.ts` (`canManageSite`,
    `canSellOnSite`) di atas `SiteStanding` — **tiga** fakta dari tiga tabel.
  - **`SiteStanding.businessRole` selalu peran di business PEMILIK SITUS INI**,
    bukan peran global si pemanggil. Owner sebuah business bukan siapa-siapa di
    storefront orang lain.
  - Di database, `lp_get_my_profile_role()` masih mengembalikan
    `company | agent | customer` — sebelas policy memanggilnya — tapi nilainya
    **diturunkan**: `is_platform` → company, business → agent, sisanya customer.
    `lp_manages_site()` dan `lp_can_sell()` ditulis ulang ke model baru.
- **Empat gate, jangan tertukar** (`lib/actions/profiles.ts`):
  - `requireAdmin()` / `requirePlatform()` — Platform. Aksi yang **tidak boleh
    didelegasikan**: buat/hapus situs, hapus akun, ban, angkat operator Platform.
  - `requireSiteAdmin(siteId?)` — Platform atau peran **business** pemilik situs
    itu. **Wajib menerima `siteId` yang dikirim klien**, bukan situs yang
    kebetulan sedang dilihat.
  - `canSellProducts()` — Platform & anggota business mana pun (**staff ikut**:
    menjual memang pekerjaannya). `canSellOnCurrentSite(siteId)` versi
    per-situsnya, dan ia menanyakan business PEMILIK situs itu.
  - `requireFeature(key)` — **gabungan** dari tiap jalan masuk yang dia punya,
    bukan yang pertama cocok: Platform & business selalu lolos, staff lewat matriks
    business, sisanya lewat matriks situs. Ambil yang pertama cocok dan menambah
    peran bisa MENGURANGI izin. Nav panel digambar dari `getAccessibleFeatures()`.
- **Siapa boleh mengubah setelan situs** (diubah 2026-09-24):
  | layar | siapa |
  |---|---|
  | **Identitas situs** (`/panel/branding`) | siapa pun yang bekerja di business pemilik situs — **staff ikut**. Menamai toko & memilih logo itu pekerjaan menjalankannya. |
  | Domain sendiri (`/panel/domains`), Links, Tracking, Popup, Halaman | peran **business** saja (`businessOnly` di sidebar, `requireSiteAdmin` di halaman) |
  | Tampilan panel (`/panel/appearance`), Situs & domain lintas-business (`/panel/sites`) | **Platform saja**. `/panel/appearance` bukan setelan situs meski terlihat begitu: itu palet PANEL, satu baris di situs kanonik, dipakai semua business. |
  - **Policy-nya ikut dibuka, bukan cuma gerbang aplikasinya.** `lp_sites` dulu
    hanya punya policy UPDATE untuk Platform; membuka layarnya tanpa itu berarti
    layar yang bisa dibuka dan tombol Simpan yang menolak. Sekarang ada policy
    `lp_works_in_site_business(id)` + trigger `lp_sites_identity_guard` yang
    tetap menolak `host`, `is_canonical`, `business_id`, `active`, dan seluruh
    kolom verifikasi/sertifikat — RLS tidak bisa membandingkan baris lama dengan
    yang baru, trigger bisa. Penjaga itu hanya berlaku saat ada `auth.uid()`,
    supaya migration & service_role tidak ikut tertahan.
- **Shell panel adalah PILIHAN, bukan vonis** (2026-09-25). `lib/panel-shell.ts`
  menjawab "apakah orang ini cuma pembeli"; `lib/panel-view.ts` menjawab
  pertanyaan lain: orang yang punya toko juga berbelanja. Cookie
  `lp_panel_view` menyimpan pilihannya, tombolnya di menu akun (dirender kedua
  shell, jadi perjalanannya pulang-pergi). **Customer-only menang atas cookie**
  — yang tidak punya kemampuan bisnis tidak boleh diberi rail berisi 26 menu
  yang semuanya akan menolaknya.
  - Karena itu **"Pembelian saya" & "Favorit" dicabut dari sidebar bisnis**.
    Keduanya layar pelanggan; di rail yang dibangun untuk mengurus toko mereka
    terbaca seperti menu orang lain. Sekarang dicapai lewat tombol ganti
    tampilan, bukan dengan menempelkannya ke back office.
- **Menu yang ditolak WAJIB mengatakannya.** Semua layar ber-gate dulu menjawab
  gagal dengan `redirect("/panel")` telanjang: menunya hilang saat diklik dan
  dashboard muncul tanpa penjelasan — tidak bisa dibedakan dari salah klik, dan
  tidak pernah menyebut izin mana yang kurang. Sekarang `deniedPath("<menu>")`
  (`lib/panel-view.ts`), dan `/panel` menampilkan pemberitahuannya. Nilainya
  dicocokkan ke daftar yang dikenal sebelum sampai ke halaman, jadi tidak ada
  string sembarangan yang bisa dipantulkan ke layar.
- **Dua shell panel, satu set route.** `/panel` melayani dua audiens yang nyaris
  tidak beririsan: business menjangkau 26 layar, customer menjangkau empat. Jadi
  yang bercabang **shell-nya**, bukan route-nya — halaman yang sama dirender di
  bingkai yang cocok, tidak ada yang dipindah atau diduplikasi.
  - Aturannya di `lib/panel-shell.ts` (`isCustomerOnly`), dipakai sekali di
    `app/panel/layout.tsx`. Ditulis sebagai daftar hal yang **tidak** bisa dia
    lakukan: bukan Platform, tanpa peran business, tidak boleh jual di situs ini
    (yaitu: bukan anggota business pemiliknya), dan nol fitur terdelegasi. **Satu
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
- **Tiga sumbu tema, saling bebas** — masing-masing menjawab pertanyaan berbeda:
  | sumbu | pertanyaan | di mana |
  |---|---|---|
  | `template` | apa yang ada di halaman | `lib/templates/registry.tsx`, `lp_sites.template` |
  | `palette` | warnanya apa | `lib/palette.ts`, `lp_sites.palette` |
  | `skin` | permukaannya terbuat dari apa (radius, bayangan, blur) | `lib/skin.ts`, `lp_sites.skin` |
  - **Kenapa skin cuma ~25 baris CSS, bukan refactor 185 file:** Tailwind v4
    mengompilasi `rounded-xl` jadi `border-radius: var(--radius-xl)` dan
    `backdrop-blur-md` jadi `blur(var(--blur-md))`. Mendefinisikan ulang empat
    variabel mengubah ~660 pemakaian sekaligus. Bayangan pengecualian — nilainya
    di-inline ke `--tw-shadow` — jadi itu di-override per class.
  - Tailwind menaruh utility-nya di `@layer utilities`, dan aturan **tanpa layer
    selalu menang** atas yang berlayer, berapa pun urutannya. `<style>` dari
    `skinCss()` tanpa layer, jadi override-nya pasti, bukan adu specificity.
  - **Setiap skin WAJIB memancarkan semua token, termasuk `glass` yang isinya
    nilai bawaan Tailwind.** Root layout menulis skin storefront, panel layout
    menulis skin panel SESUDAHNYA; kalau default-nya diam, storefront `flat`
    akan bocor ke panel `glass` dan dua cakupan itu tidak benar-benar bebas.
  - Panel punya setelan sendiri di `lp_site_settings` key `panel_skin`
    (`/panel/appearance`), seperti `panel_palette`. Storefront diatur di
    `/panel/branding`, di bawah palette.
- **Delegasi fitur admin**: daftar fitur yang bisa diberikan ada di `lib/features.ts`
  (`ADMIN_FEATURES`: stats, users, categories, contacts, inbox, hero, content, legal,
  hiring, custom-js). **Dua matriks, dua sumbu, sengaja tidak digabung**
  (`lib/role-permissions.ts`, keduanya diedit di `/panel/roles`):
  - **per SITUS** — `customer`, di `lp_site_settings` key
    `role_permissions`, dibaca lewat `getRolePermissions(siteId)` yang ter-cache
    (tag `role-permissions`). Dengan baris kanonik sebagai cadangan, jadi situs
    yang belum pernah mengaturnya tidak kehilangan delegasi.
  - **per BUSINESS** — `staff`, di kolom `lp_businesses.role_permissions`,
    dibaca lewat `getBusinessRolePermissions()`. Owner tidak ada di matriksnya:
    business yang bisa dikunci dari business-nya sendiri itu tiket support, bukan
    fitur. Default (belum pernah diatur) = staff kosong: business yang memutuskan
    apa yang bisa dicapai orang yang baru dia ajak.
- **Staff hanya melihat penjualannya sendiri**: pemisahan ada di
  `lib/actions/sales.ts` (satu read yang sudah di-scope), **bukan** di halaman —
  supaya angka seluruh business tidak bisa diraih dengan merender komponen lain.
- Customer melihat pembelian, invoice, review.
- **Hapus user** (`DELETE /api/admin/users`, tombol di `/panel/users`): Platform
  saja — beda dari **keluarkan dari situs** (`fromSite: true`) yang boleh
  dilakukan pengelola situs dan hanya mencabut satu baris keanggotaan — ban itu kontrol yang bisa dibatalkan dan boleh didelegasikan, hapus tidak.
  Ditolak untuk: diri sendiri, akun Platform (cabut statusnya dulu), dan akun yang
  **masih punya produk** — `lp_landing_pages.user_id` cascade, jadi menghapus
  pemiliknya ikut menghapus katalog beserta filenya.
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
  • jika ada → tombol "Download ZIP" → /api/download/{slug} (produk digital saja;
    jenis lain menampilkan catatan pemenuhan penjual — lihat "Jenis produk")
  • PurchaseTracker fires event `purchase` (GA4 + Meta Pixel), dedup via merchantOrderId
GET /api/download/[slug]
  • cek login + ada record di lp_purchases (RLS) + product_type = digital
  • URL bertanda HMAC (lib/backend/storage.ts, 1 jam) → redirect
```

### Tabel `lp_purchases`
`id, user_id (FK auth.users, **nullable** — NULL = akunnya sudah dihapus), landing_page_id (FK lp_landing_pages), purchased_at, amount, payment_method, invoice_number (UNIQUE), fulfillment_status, fulfillment_note, fulfilled_at, UNIQUE(user_id, landing_page_id)`.

## Jenis produk & siklus pesanan (Fase 6)

Katalog ini **tidak lagi mengandaikan sebuah file**. `lp_landing_pages.product_type`
= `digital | physical | service`, dan aturan turunannya ada di satu modul,
`lib/product-type.ts` (`deliversFile`, `initialFulfillment`, transisi status) —
bukan sebagai `=== "digital"` yang tersebar. Field per-jenis: `sku`/`stock`/`unit`
(fisik; `stock` NULL = tidak dilacak, 0 = habis), `service_duration_minutes`/
`service_mode` (jasa), `fulfillment_note` (tampil ke pembeli sesudah bayar).

Pembelian punya siklus: `lp_purchases.fulfillment_status`
`pending → processing → done`, atau `cancelled`. Produk digital lahir `done`
(dibayar = diterima); selain itu lahir `pending` dan muncul sebagai pesanan di
`/panel/sales`. **DUA invarian, keduanya gagal senyap:**

1. **Status pemenuhan TIDAK menentukan akses.** Akses = ada baris `lp_purchases`
   dengan `revoked_at` kosong — itu yang dibaca route download, reader, dan grant
   bundle. Men-gate download pada status akan mematikan produk digital yang
   statusnya tidak ter-set.
2. **`revoked_at` ≠ `cancelled`.** Yang pertama keputusan akses, yang kedua
   pernyataan tentang pesanan.

Ketiga jalur insert pembelian (gratis `addPurchase`, callback Duitku, dan
`grantBundleItems`) **wajib** menuliskan status dari `product_type` — bundle
per-item, bukan per-bundle.

### Alamat kirim & stok (Fase 6b)

- **Alamat = snapshot di `lp_purchases`** (`shipping_*`), bukan di profil: alamat
  di `lp_profiles` akan terbaca setiap business tempat orang itu pernah belanja.
- **`lp_pending_shipping`** menampung alamat antara "klik bayar" dan "callback
  datang", karena baris pembelian berbayar ditulis server-to-server tanpa form.
  Diisi `create-invoice`, dibaca + dihapus callback. **Penjual tidak punya akses
  ke tabel ini** — alamat baru jadi urusannya setelah pembayaran berhasil.
  Sengaja TIDAK lewat `additionalParam`: field itu pergi ke Duitku.
- **Stok bergerak di trigger `lp_sync_product_stock`**, dan trigger itu **tidak
  pernah menolak insert**: saat stok 0 pembelian tetap masuk, karena di jalur
  callback uangnya sudah diterima. Gerbang "stok habis" ada di checkout
  (`isSoldOut`, dipakai `create-invoice` + `addPurchase`), **sebelum** uang
  berpindah. Kelebihan jual = pesanan yang harus diselesaikan penjual.
- **`lp_purchases.stock_held`** mencatat apakah pesanan itu benar-benar mengambil
  satu unit; tanpa itu, membatalkan pesanan kelebihan-jual akan **menciptakan**
  stok. Stok kembali saat batal dan saat baris dihapus.
- **`stock` NULL = tidak dilacak**, 0 = habis. NULL tidak boleh pernah terbaca
  sebagai habis.

Yang masih terbuka (kurir/ongkir, nomor resi sebagai field sendiri, slot jadwal
jasa) di `docs/plans/multi-business-saas.md` Fase 6 & 6b.

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
