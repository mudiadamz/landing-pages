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
| 0 | Perbaiki signup yang patah + pasang rel tes integrasi | ⬜ |
| 1 | Characterization test: RLS & GRANT (69 policy, 34 tabel) | ⬜ |
| 2 | Characterization test: trigger, RPC, constraint | ⬜ |
| 3 | Kontrak Auth & sesi | ⬜ |
| 4 | Kontrak Storage | ⬜ |
| 5 | Rapikan temuan yang sudah terlanjur ketahuan | ⬜ |
| 6 | Gerbang CI + keputusan resource | ⬜ |

---

## Fase 0 — perbaiki yang patah, pasang relnya

**Kenapa duluan:** tidak ada gunanya menulis tes di atas database yang signup-nya
mati, dan fase 1–4 semuanya butuh rel yang sama.

1. ✅ sudah: `20260919000000_fix_handle_new_user_account_type.sql`.
2. **Putuskan soal produksi.** Kalau `20260903010000` sudah pernah di-`db push`
   ke Supabase hosted, pendaftaran di produksi sedang mati dan perbaikan ini
   harus naik lebih dulu, terpisah dari sisa rencana ini.
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
satu tes contoh (signup membuat profil) lolos.

---

## Fase 1 — characterization test: RLS & GRANT

Tes ditulis dari sudut pandang **penyerang**, bukan dari sudut pandang policy.
Menulis ulang isi policy jadi assertion cuma menyalin bug; yang dijaga adalah
perilakunya.

Minimal, satu tes per baris berikut, masing-masing sebagai `anon`, sebagai pemilik,
dan sebagai orang lain:

- `lp_profiles`: naik pangkat sendiri **ditolak**; ubah `full_name` **boleh**;
  baca profil orang lain **0 baris**. (Tiga skenario di atas sudah terbukti —
  tinggal dikodekan.)
- `lp_purchases`: pembeli melihat miliknya; yang `revoked_at` **tidak** terlihat;
  tidak ada jalan UPDATE/DELETE lewat API publik.
- `lp_landing_pages`: pemilik CRUD penuh; orang lain baca saja.
- Enam tabel tanpa policy: `anon` dan `authenticated` dapat **0 baris** dan
  **gagal** menulis. Ini yang menjaga temuan #2.
- Storage: folder `<uid>/…` hanya bisa ditulis pemiliknya; `landing-downloads`
  tidak bisa dibaca tanpa signed URL; `publisher-kyc` tertutup bagi semua orang.

**Verifikasi:** matikan satu policy secara manual di database lokal → tes yang
bersangkutan harus **merah**. Tes yang tidak pernah bisa gagal bukan tes.

---

## Fase 2 — trigger, RPC, constraint

- `lp_handle_new_user`: signup email → `email_verified_at` NULL; signup Google →
  terisi. (Sudah terbukti manual di fase 0 — kodekan.)
- Trigger hitung: `sold_count`, `rating`, `like_count` naik/turun benar saat
  baris ditambah **dan** dihapus.
- `lp_increment_view`: bisa dipanggil `anon`, dan **hanya** menaikkan view_count.
- `lp_track_session`: dipanggil dua kali dengan `session_id` sama → satu baris,
  pageview bertambah.
- Idempotensi uang: insert `lp_purchases` ganda `(user_id, landing_page_id)`
  ditolak; `merchant_order_id` ganda di `lp_plan_orders` ditolak — inilah yang
  membuat callback Duitku yang diulang tidak menggandakan pembelian.
- `ON DELETE` per tabel: hapus user → produk ikut terhapus (CASCADE), tapi
  `lp_purchases.user_id` jadi NULL dan **barisnya tetap ada**. Omzet tidak boleh
  berubah karena satu akun dihapus.

---

## Fase 3 — kontrak Auth & sesi

Delapan method yang benar-benar dipakai: `signInWithPassword`, `signUp`,
`signOut`, `signInWithOAuth`, `exchangeCodeForSession`, `getUser`,
`admin.updateUserById`, `admin.deleteUser`, `admin.listUsers`.

Yang paling rawan bukan itu, tapi **refresh cookie** di `lib/supabase/proxy.ts`:
token baru ditulis ke request yang sedang jalan **dan** ke response, dalam satu
lintasan. Salah sedikit → bug sesi basi yang cuma muncul di tab kedua.

- Tes kontrak: sesi kedaluwarsa + refresh token sah → request berikutnya sudah
  bawa cookie baru, dan Server Component di lintasan yang sama melihat user.
- Catat perilaku yang sudah ada: middleware **melewati** lookup sesi kecuali path
  `/panel/*`, `/read/*`, `/login`, `/signup`. Halaman publik tidak pernah
  di-refresh oleh middleware.
- `safeNextPath` sudah ada tesnya; tambah jalur `?sf=` di `lib/oauth-return.ts` —
  host yang tidak terdaftar di `lp_sites` harus ditolak.

---

## Fase 4 — kontrak Storage

Lima bucket, dan salah satunya masalah:

| Bucket | Publik | Di migration? |
|---|---|---|
| `landing-assets` | ya | ya |
| `landing-downloads` | tidak | ya |
| `publisher-kyc` | tidak | ya |
| `chat-attachments` | tidak | ya |
| **`hiring-cv`** | tidak | **TIDAK** |

`hiring-cv` dibuat manual dan tidak pernah masuk version control. Database lokal
cuma punya 4 bucket — artinya `/api/hiring-test` **sudah patah** di environment
mana pun yang dibangun dari migration, dan migrasi backend akan melewatkannya
diam-diam. Fase ini menambahkan migration-nya.

Tes: batas ukuran, mime type yang ditolak, signed URL kedaluwarsa, dan file di
folder orang lain tidak bisa disentuh.

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
