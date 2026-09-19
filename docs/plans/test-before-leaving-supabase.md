# Rencana: jaring tes sebelum Supabase dicabut

> **Dokumen kerja.** Boleh berhenti kapan saja dan dilanjutkan sesi lain.
> Tiap fase berdiri sendiri: punya cara verifikasi, dan tidak merusak apa pun
> kalau fase berikutnya tidak pernah dikerjakan.

Dibuat 2026-09-19. Status terakhir ada di tabel di bawah — **itu satu-satunya
tempat status ditulis.** Jangan menambah catatan status di tempat lain; salinan
kedua pasti menyimpang.

---

## Kenapa dokumen ini ada

Rencananya mengganti Supabase dengan susunan sendiri yang sehemat mungkin. Sebelum
itu, pertanyaannya: kalau penggantinya berperilaku beda, apa yang akan memberi
tahu kita?

Hari ini: **tidak ada.**

Repo punya 131 tes yang lolos. Semuanya pure function — `vitest.config.ts` bahkan
menuliskan itu sebagai niat: *"no dev server, no database, no network"*. Tidak
satu pun menyentuh database, HTTP, atau sesi.

Itu bukan teori. Waktu dokumen ini ditulis, migration `20260903010000` menghapus
`lp_profiles.role` tanpa memperbarui trigger `lp_handle_new_user()` yang masih
menulis ke kolom itu. Akibatnya **setiap pendaftaran akun gagal** — signup email
dan login Google pertama kali, keduanya. Seluruh 131 tes tetap hijau selama itu.
Perbaikannya ada di `20260919000000_fix_handle_new_user_account_type.sql`.

Satu bug itu memetakan seluruh masalahnya: yang paling mungkin patah saat pindah
backend adalah lapisan yang **nol** tesnya.

---

## Yang dijaga hari ini vs yang tidak

Diukur dari database yang jalan (`supabase_db_landing_pages`), bukan dari membaca
migration — migration menghitung ganda policy yang pernah diganti.

| Lapisan | Ukuran | Tes |
|---|---:|---|
| Fungsi murni (slug, sanitasi HTML, i18n, predikat izin, warna/ikon) | 16 file | **131** |
| RLS policy aktif (`public` + `storage`) | 69 | 0 |
| Tabel dengan RLS menyala | 34 dari 34 | 0 |
| Function `SECURITY DEFINER` | 27 | 0 |
| Trigger | 16 | 0 |
| Server Action (`lib/actions/*`) | 26 file | 0 |
| `middleware.ts` + `lib/supabase/proxy.ts` (refresh sesi) | — | 0 |
| Pembayaran (`lib/duitku.ts`, `lib/invoice.ts`) | — | 0 |

`lib/site-membership.ts` **ada** tesnya, tapi itu predikat murni. Gerbang yang
benar-benar menahan orang — `requireAdmin`, `requireSiteAdmin`, RLS, GRANT kolom —
tidak ada satu pun.

---

## Tiga hal yang akan diam-diam hilang saat porting

Ini bukan daftar lengkap; ini tiga yang sudah terbukti tidak akan tertangkap oleh
cara kerja sekarang.

### 1. Yang menahan self-promote bukan RLS, tapi GRANT kolom

Policy UPDATE di `lp_profiles` berbunyi `auth.uid() = id` — **tanpa batasan
kolom**. Kalau cuma itu yang ada, siapa pun bisa menulis `account_type='company'`
ke barisnya sendiri.

Yang sebenarnya menahan adalah privilege Postgres per-kolom, dipasang di
`20260713000000_publisher_role.sql`:

```sql
revoke update on lp_profiles from authenticated;
grant  update (full_name) on lp_profiles to authenticated;
```

Dibuktikan langsung di database lokal:

| Skenario | Hasil | Yang menahan |
|---|---|---|
| user login set `account_type='company'` pada dirinya | `permission denied` | GRANT kolom |
| user login ubah `full_name` sendiri | `UPDATE 1` | — |
| anon set `account_type='company'` | `UPDATE 0` | RLS |
| user login baca profil orang lain | 0 baris | RLS |

Port yang menyalin "semua RLS policy" dan melewatkan GRANT membuka lubang
naik-pangkat yang sungguhan. Dan tidak ada tes yang akan berteriak.

**Temuan sampingan:** `anon` masih memegang GRANT UPDATE ke `account_type`,
`plan`, `is_active`, `email_verified_at` — penguncian 2026-07-13 hanya diterapkan
ke `authenticated`. Hari ini tidak bisa dieksploitasi karena RLS menolak duluan
(`auth.uid()` NULL), jadi ini pertahanan berlapis yang bolong satu lapis, bukan
lubang terbuka. Tetap layak dicabut — lihat fase 5.

### 2. Enam tabel yang keamanannya berupa ketiadaan

`lp_sessions`, `lp_page_events`, `lp_ip_geo`, `lp_excluded_ips`,
`lp_signup_attempts`, `lp_promo_subscribers` punya RLS menyala dan **nol policy**.
Bucket `publisher-kyc` sama.

"Tidak ada policy" di situ **adalah** keputusan keamanannya: hanya service-role
yang boleh masuk. Backend baru yang menerjemahkan "tabel ini tidak punya aturan"
jadi "tabel ini bebas" membocorkan IP pengunjung, daftar email promo, dan berkas
KTP. Ini bentuk kegagalan yang tidak terlihat di layar — halaman tetap merender,
malah dengan lebih banyak data.

### 3. Trigger yang menempel di tabel milik Supabase

`on_auth_user_created` menempel di **`auth.users`** — tabel yang dimiliki
`supabase_auth_admin`, bukan kita. Backend sendiri tidak punya `auth.users` untuk
ditempeli, jadi pembuatan profil harus pindah jadi langkah eksplisit di
transaksi "buat akun".

Bug yang memicu dokumen ini terjadi tepat di fungsi ini.

---

## Yang TIDAK perlu ditiru

Menyempitkan lingkup sama pentingnya dengan mendaftar pekerjaan:

- **Realtime — tidak dipakai.** Nol `.channel(` / `.subscribe(`. Container
  realtime memakan 195 MB murni sebagai ongkos yang tidak terpakai.
- **Edge Functions — tidak dipakai.** Nol `functions.invoke(`.
- **Generated type `Database` — tidak ada.** Semua call site diketik manual. Sisi
  baiknya: tidak ada `createClient<Database>()` yang harus dirombak. Sisi
  buruknya, dan ini yang penting untuk dokumen ini: **TypeScript tidak akan
  menangkap bentuk respons yang meleset.** Tes adalah satu-satunya jaring.

Permukaan yang benar-benar dipakai: Postgres (PostgREST + 2 RPC), Auth (8 method),
Storage (5 bucket).

---

## Cara melanjutkan

1. Lihat tabel status. Ambil fase pertama yang belum ✅.
2. Kerjakan **satu fase**, verifikasi dengan cara yang ditulis di fase itu,
   commit, centang tabelnya dalam commit yang sama.
3. Kalau kenyataan berbeda dari dokumen ini, perbaiki dokumen ini di commit itu
   juga.

**Aturan yang mengikat seluruh rencana:** tes di fase 1–4 ditulis supaya lolos
melawan Supabase **hari ini**. Itu yang membuatnya jadi definisi "berhasil" untuk
penggantinya nanti — tes yang lahir bersama backend baru cuma memotret bug backend
baru.

---

## Status

| Fase | Isi | Status |
|---|---|---|
| 0 | Perbaiki signup yang patah + pasang rel tes integrasi | ✅ |
| 1 | Characterization test: RLS & GRANT (69 policy, 34 tabel) | ✅ |
| 2 | Characterization test: trigger, RPC, constraint | ✅ |
| 3 | Kontrak Auth & sesi | ✅ |
| 4 | Kontrak Storage | ✅ |
| 5 | Rapikan temuan yang sudah terlanjur ketahuan | ⬜ |
| 6 | Gerbang CI + keputusan resource | ⬜ |

---

## Fase 0 — perbaiki yang patah, pasang relnya

**Kenapa duluan:** tidak ada gunanya menulis tes di atas database yang signup-nya
mati, dan fase 1–4 semuanya butuh rel yang sama.

1. ✅ sudah: `20260919000000_fix_handle_new_user_account_type.sql`.
2. **Produksi — terdampak.** Diperiksa 2026-09-19 dengan probe baca-saja (anon
   key, `select=role&limit=0`): di project hosted, `lp_profiles.role` **sudah
   tidak ada** dan `account_type` ada. Artinya `20260903010000` sudah naik ke
   produksi, dan trigger yang masih menulis ke `role` ikut bersamanya —
   pendaftaran di produksi mati sejak itu. Perbaikannya **belum** diterapkan ke
   produksi: menulis ke database produksi adalah keputusan Adam, bukan bagian
   yang dikerjakan otomatis. Perintahnya: `pnpm exec supabase db push`
   (setelah `supabase link`), dan periksa dulu daftar migration yang akan ikut
   naik dengan `supabase migration list --linked`.
3. Tambah dependency: klien Postgres langsung (`pg` atau `postgres`) sebagai
   devDependency. Repo sekarang **tidak punya** — semua akses lewat SDK Supabase,
   jadi tes tidak bisa menyamar jadi role `anon`/`authenticated`.
4. Buat `tests/db/helper.ts`: buka koneksi ke `127.0.0.1:54322`, sediakan
   `asRole(role, uid, fn)` yang membungkus `set local role` + `set_config(
   'request.jwt.claims', …)`, dan jalankan **setiap tes di dalam transaksi yang
   di-rollback** supaya urutan tes tidak pernah berpengaruh.
5. Pisahkan config: `vitest.config.ts` tetap murni dan cepat; tambah
   `vitest.db.config.ts` (`include: tests/db/**`) plus script `test:db`.
   Pemisahannya disengaja — `pnpm test` harus tetap bisa jalan tanpa Docker.

**Verifikasi:** `pnpm test` tetap 131 lolos tanpa Docker; `pnpm test:db` jalan dan
`tests/db/signup.test.ts` lolos. **Dicek juga sebaliknya:** dengan trigger versi
rusak dipasang kembali, kelima tesnya merah.

---

## Fase 1 — characterization test: RLS & GRANT

Tes ditulis dari sisi **penyerang** dengan kontrak yang *seharusnya* berlaku.
Yang merah adalah lubang; lubangnya ditutup di migration, lalu dibuktikan dua
arah (dipasang kembali → merah, dipulihkan → hijau). Menulis ulang isi policy
jadi assertion cuma menyalin bug.

**Hasil: 135 tes di `tests/db/`**, ditambah `tests/product-free.test.ts` di suite
murni.

| File | Menjaga |
|---|---|
| `schema-contract.test.ts` | Setiap kolom yang disebut kode (`select`, filter, `order`, `onConflict`, kunci `insert`/`update`) ada di database. Pengganti jaring kompilator yang tidak pernah ada. |
| `rls-profiles.test.ts` | Dua lapis profil: RLS (baris mana) + grant kolom (kolom mana), plus daftar keputusan per kolom. |
| `rls-commerce.test.ts` | Pembelian, produk, ulasan, like, pesanan paket, versi. |
| `rls-sites.test.ts` | Setelan situs, situs, kategori, halaman, keanggotaan. |
| `rls-private.test.ts` | Tabel yang keamanannya berupa ketiadaan policy (+ daftar lengkapnya), inbox, kontak, event produk. |
| `rls-chat.test.ts` | Percakapan MbahGPT privat, dan tidak bisa ditulisi orang lain. |
| `rls-storage.test.ts` | Policy per bucket, termasuk `landing-downloads` yang tidak bisa dibaca siapa pun lewat API. |
| `rls-surface.test.ts` | Snapshot seluruh policy, grant per-kolom, dan fungsi `SECURITY DEFINER` — sekaligus daftar persis yang harus di-port. |

**Yang ditemukan — semua sudah diperbaiki kecuali yang ditandai:**

| Temuan | Jenis | Perbaikan |
|---|---|---|
| `/panel/users` membalas 500 untuk semua orang (`.order("role")`) | bug hidup | `776bdce` |
| Daftar customer tanpa nama/email (select dari tabel yang salah) | bug hidup | `776bdce` |
| Tolak publisher: path KTP tetap menunjuk file yang sudah dihapus | bug hidup | `776bdce` |
| Ganti/hapus avatar gagal "permission denied" sejak 2026-08-09 | bug hidup | `20260919010000` |
| Akun tanpa profil bisa lahir sebagai `company` / plan berbayar / email "terverifikasi" | lubang | `20260919010000` |
| **Produk berbayar bisa diambil gratis** (replay form "Ambil gratis" atau POST ke PostgREST) | lubang, uang | `20260919020000` + `isFreeProduct` |
| Customer biasa bisa membuat & menerbitkan produk tanpa gerbang publisher | lubang | `20260919020000` |
| Penjual bisa menulis `sold_count`/`rating`/`view_count`/`like_count` sendiri | lubang, kepercayaan | `20260919020000` |
| Siapa pun bisa mengulas tanpa membeli (menjatuhkan rating pesaing) | lubang | `20260919020000` |
| **Agent tidak bisa menyimpan satu pun setelan situsnya** (tracking, paket, popup, hero, legal, …) | bug hidup | `20260919030000` |
| **Customer mana pun bisa membaca seluruh inbox support** lewat PostgREST | lubang, privasi | `20260919030000` |
| Orang bisa menulis ke sesi/pesan/memori chat milik orang lain | lubang, integritas | `20260919030000` |
| Dua fungsi trigger `SECURITY DEFINER` tanpa `search_path` | pengerasan | `20260919040000` |
| Draft (`published=false`) terbaca siapa pun lewat PostgREST | **celah diketahui** | dikunci `it.fails`; mengetatkannya menyentuh puluhan jalur baca |
| Customer yang diberi fitur lewat `role_permissions` tidak bisa menulis (gerbang aplikasi meloloskan, RLS tidak) | **celah diketahui** | meniru peta peran di SQL = menyalin `lib/role-permissions.ts` |

**Verifikasi:** setiap perbaikan dibuktikan dua arah — dengan policy/grant lama
dipasang kembali, tes yang relevan merah; dipulihkan, hijau.

---

## Fase 2 — trigger, RPC, constraint

`tests/db/logic.test.ts` — 27 tes. Logika yang hidup **di dalam** database, tidak
terlihat dari sisi TypeScript, dan harus dibangun ulang dengan tangan di backend
tanpa trigger Postgres.

- **Trigger penghitung** (`sold_count`, `like_count`, `rating`, `updated_at`)
  bergerak walau pemicunya — pembeli, penyuka, pengulas — tidak boleh menulis
  produk. Itu karena triggernya `SECURITY DEFINER`; backend yang menjalankan
  logika ini dengan hak pemanggil akan berhenti menghitung tanpa suara.
  Mencabut akses **tidak** mengurangi `sold_count` — penjualannya tetap terjadi.
- **RPC:** `lp_increment_view` bisa dipanggil anon dan hanya menaikkan
  `view_count`; `lp_track_session` dengan sesi yang sama = satu baris.
- **Constraint bisnis:** satu pembelian per orang per produk (callback Duitku
  yang diulang tidak menggandakan), `merchant_order_id` unik, nomor invoice unik
  bila ada, satu situs kanonik, slug halaman unik **per situs**, memori chat tidak
  dobel tanpa peduli huruf besar-kecil, dan semua CHECK (rating, persen potongan,
  tipe preview/pembelian, bulan & status paket, peran pesan chat, locale, jenis
  akun).
- **Menghapus user:** pembelian & pesanan paket **bertahan** tanpa nama (omzet
  tidak berubah); data pribadi (profil, ulasan, like, chat, keanggotaan) ikut
  pergi. Dan satu cascade yang jadi alasan aturan aplikasi: **menghapus penjual
  ikut menghapus pembelian orang lain atas produknya** — itu kenapa
  `DELETE /api/admin/users` menolak akun yang masih punya produk.

**Ditemukan & diperbaiki** (`20260919050000`):

- `lp_track_session` punya **dua overload** — yang lama tertinggal dari
  `20260808050000`. Pemanggil yang melewatkan `p_site_id` mendapat "could not
  choose the best candidate function" dari PostgREST dan kunjungannya hilang.
- `lp_track_session` bisa dipanggil **anon & user login** lewat
  `/rest/v1/rpc`: siapa pun bisa menulis sesi dengan IP, negara, UTM, bahkan
  `p_user_id` pilihannya. Sekarang hanya service role (jalur `/api/analytics`).

---

## Fase 3 — kontrak Auth & sesi

`tests/db/auth-http.test.ts` (13 tes, lewat HTTP ke GoTrue lokal yang sungguhan)
dan `tests/oauth-return.test.ts` (6 tes, suite murni).

- **Pendaftaran:** signup email langsung mendapat sesi — tidak ada gerbang
  konfirmasi (produksi `mailer_autoconfirm=true`; verifikasi dikerjakan
  aplikasi sendiri lewat Resend). Profil lahir `customer`, belum terverifikasi.
  Kata sandi < 6 karakter ditolak.
- **Masuk & identitas:** sandi salah ditolak, token dikenali `getUser`, token
  sampah tidak, refresh token menghasilkan pasangan baru (rotasi).
- **Tindakan admin:** ban persis seperti yang dikirim `/api/admin/users`
  (`ban_duration` `876000h` / `none`); `deleteUser` lewat GoTrue menghapus profil
  dan membiarkan pembeliannya bertahan tanpa nama.
- **Middleware (`lib/supabase/proxy.ts`):** tanpa sesi `/panel` → `/login`; sesi
  sah lewat dengan `x-pathname`; `/login` saat sudah masuk → `?next=` yang aman
  atau `/panel`, dan `//evil.example` ditolak. **Access token kedaluwarsa
  diperbarui di tempat** — token baru ditulis ke response **dan** diteruskan ke
  server components. Halaman publik **tidak** menyentuh sesi sama sekali.
- **Gerbang OAuth lintas domain** (`resolveReturnHost`): hanya host di
  `lp_sites`; domain asing dan domain yang cuma *mirip* ditolak.

Dicek dua arah: merusak penulisan cookie ke request, lalu ke response, di
`proxy.ts` — masing-masing membuat tes refresh merah. Merusak gerbang OAuth
membuat dua tesnya merah. (Pemeriksaan pertama justru menemukan asersi yang
kosong: awalan base64 semua cookie sesi sama, jadi tes lolos dengan cookie basi.
Sekarang yang dibandingkan token hasil decode.)

**Ditemukan & diperbaiki:**

- **Stack lokal tidak sama dengan produksi.** Container GoTrue dibuat 22 Juni,
  sebelum `config.toml` mematikan konfirmasi email — jadi lokal masih meminta
  konfirmasi sementara produksi tidak. `supabase start` saja tidak memperbaikinya;
  container harus dibuat ulang (`supabase stop && supabase start -x
  vector,logflare` — `vector` me-mount socket Docker yang tidak bisa di-mount di
  colima). `tests/db/global-setup.ts` sekarang menolak jalan kalau drift ini
  terjadi lagi.
- `admin.auth.admin.listUsers({ perPage: 1000 })` di analitik berhenti diam-diam
  di user ke-1001, dan cuma dipakai untuk email yang sudah ada di
  `lp_profiles.email`. Dibuang — permukaan Auth yang harus ditiru backend
  pengganti berkurang satu method.

**Celah yang tidak bisa diuji di sini:** `exchangeCodeForSession` dengan Google
sungguhan — butuh provider OAuth yang terkonfigurasi. Yang diuji adalah
gerbangnya (`resolveReturnHost`) dan `safeNextPath`; penukaran kodenya sendiri
tetap harus dicoba tangan sekali di produksi setiap kali backend auth berubah.

---

## Fase 4 — kontrak Storage

`tests/db/storage-http.test.ts` (13 tes, lewat Storage API lokal) melengkapi
`rls-storage.test.ts` di level SQL. Batas ukuran dan jenis file hanya ditegakkan
Storage API, dan penghapusan hanya bisa lewat API — dua hal yang tidak terlihat
dari SQL.

| Bucket | Publik | Batas | Jenis | Siapa menulis | Siapa membaca |
|---|---|---|---|---|---|
| `landing-assets` | ya | 50 MB | semua | **penjual**, foldernya sendiri | siapa pun |
| `landing-downloads` | tidak | 50 MB | zip, pdf, epub | **penjual**, foldernya sendiri | **tidak ada** — hanya signed URL dari server sesudah cek pembelian |
| `chat-attachments` | tidak | 8 MB | daftar tetap | pemilik, foldernya | pemilik |
| `publisher-kyc` | tidak | 5 MB | JPEG | service role | service role |
| `hiring-cv` | tidak | 5 MB | PDF | service role | service role |

**Ditemukan & diperbaiki:**

- **`hiring-cv` tidak pernah ada di migration** (`20260919060000`). Dibuat tangan
  di dashboard produksi; database lokal, CI, dan backend pengganti mana pun tidak
  punya bucket-nya, jadi `/api/hiring-test` gagal di langkah upload. Migration-nya
  memakai `on conflict do update`, supaya bucket produksi — yang setelannya tidak
  pernah dicatat — dipaksa ke bentuk tertulis, terutama **privat**. Terbukti:
  menjalankannya di atas bucket yang sudah publik mengembalikannya jadi privat.
- **Customer mana pun bisa mengunggah file apa pun ke bucket publik**
  (`20260919070000`). `landing-assets` sengaja menerima semua jenis file untuk
  bundle situs, dan policy unggahnya berlaku untuk setiap user login — hosting
  gratis, termasuk halaman phishing, di domain storage proyek. Sekarang unggahan
  ke `landing-assets` dan `landing-downloads` mensyaratkan `lp_can_sell()`, sama
  dengan syarat membuat produk. Satu-satunya jalur client-user ke dua bucket itu
  adalah form produk di panel; avatar lewat service role.

Dicek dua arah: `hiring-cv` dibuat publik → dua tes merah; pengetatan unggahan
diverifikasi lewat diff snapshot (tiga policy) dan tes yang merah sebelum
migration-nya.

**Catatan, tidak diubah:** `chat-attachments` mengizinkan `text/html` dan
`text/javascript`. Bucket-nya privat dan filenya hanya terbuka lewat signed URL
di domain Supabase (bukan domain aplikasi, jadi tidak membawa cookie sesi), jadi
risikonya kecil — tapi layak diingat kalau storage pindah ke domain yang sama
dengan aplikasi.

---

## Fase 5 — rapikan temuan yang terlanjur ketahuan

- Cabut GRANT UPDATE `anon` di `lp_profiles` (temuan #1). Kerjakan **sesudah**
  fase 1, supaya tesnya yang membuktikan tidak ada yang rusak.
- Tambah migration untuk bucket `hiring-cv`.
- `admin.listUsers` dipanggil `{ perPage: 1000 }` tanpa paginasi — diam-diam
  memotong di user ke-1001.

---

## Fase 6 — gerbang CI + keputusan resource

- `pnpm test` (murni, tanpa Docker) + `pnpm test:db` (butuh Postgres) di CI.
- `supabase/verify.sql` sudah ada tapi **hanya** memeriksa sisa-sisa penggabungan
  tiga project lama; nol pemeriksaan RLS `lp_*`. Jangan dikira jaring.
- Baru di sini keputusan bentuk pengganti diambil, dengan angka: stack Supabase
  lokal = 8 container, ±710 MB, dan Postgres-nya sendiri cuma 98 MB. Sisanya —
  Kong 108, realtime 195 (tidak dipakai sama sekali), storage 132, pg_meta 111,
  auth 15 — itulah yang ditukar dengan kewajiban menulis ulang 69 policy,
  27 function, dan kontrak refresh cookie.
