# Rencana: mencabut Supabase sepenuhnya

> **Dokumen kerja.** Boleh berhenti kapan saja dan dilanjutkan sesi lain.
> Tiap fase bisa di-deploy sendiri, punya kriteria selesai yang bisa diukur, dan
> punya jalan mundur. Aplikasi tetap jalan di antara dua fase mana pun.

Dibuat 2026-09-21. Status terakhir ada di tabel di bawah — **itu satu-satunya
tempat status ditulis.**

Prasyarat: [`test-before-leaving-supabase.md`](test-before-leaving-supabase.md)
selesai (✅ semua fase). Jaring tesnya adalah definisi "berhasil" untuk rencana
ini.

---

## Keputusan yang mengatur seluruh rencana

**Postgres dan model keamanannya dipertahankan. Yang dicabut hanya lapisan
transport: PostgREST, GoTrue, storage-api, dan SDK `@supabase/*`.**

RLS, grant per kolom, trigger `SECURITY DEFINER`, dan constraint adalah fitur
Postgres, bukan Supabase. Supabase cuma menyambungkannya ke HTTP. Jadi aplikasi
melakukan persis yang sudah dilakukan harness tes (`tests/db/sql.ts` → `as()`):
membuka transaksi, lalu `set local role authenticated` dan
`set_config('request.jwt.claims', '{"sub": …}', true)`. Setelah itu:

- **62 policy tidak ditulis ulang.** `auth.uid()` di 44 policy tetap membaca klaim
  yang sama — sekarang diisi aplikasi, bukan GoTrue.
- **189 tes database tetap berlaku apa adanya**, karena menguji lapisan yang tidak
  berubah.
- **Nama role `anon` / `authenticated` / `service_role` dipertahankan**, supaya
  setiap policy dan grant tetap sama persis secara teks.

Ini juga yang menjawab kekhawatiran di rencana sebelumnya ("jangan tulis ulang
GoTrue/PostgREST"): bagian yang berbahaya dari penulisan ulang itu adalah
memindahkan aturan keamanan ke kode aplikasi, tempat hampir semua bug di rencana
itu ditemukan. Keputusan ini membuat aturannya tetap di tempat yang sudah teruji.

Bonus yang tidak kecil: sesudah PostgREST pergi, **browser tidak lagi punya jalan
langsung ke database**. Seluruh kelas lubang "satu panggilan PostgREST melewati
gerbang aplikasi" dari Fase 1 rencana sebelumnya hilang sebagai kelas. RLS tetap
dipertahankan sebagai lapis kedua.

---

## Seberapa dalam Supabase tertanam (diukur 2026-09-21)

| Permukaan | Ukuran | Diganti oleh | Fase |
|---|---:|---|---|
| File yang memakai `@supabase/*` | 77 | — | semua |
| Query tabel `.from("lp_…")` | 261 | Kysely + `pg` | 1 |
| Select bergaya join PostgREST | 5 | join SQL biasa | 1 |
| RPC | 2 | panggilan fungsi SQL | 1 |
| `createAdminClient()` (service role) | 69 | `withRls("service_role")` | 1 |
| Operasi Storage | 40 | route upload/unduh sendiri + disk | 2 |
| Client browser (`lib/supabase/client`) | 2 file | POST ke route sendiri | 2 |
| `auth.getUser()` | 82 | `getSession()` sendiri | 3 |
| Method auth lain | 8 | auth sendiri | 3 |
| Policy yang memakai `auth.uid()` | 44 | **tidak berubah** — shim `auth.uid()` | 4 |
| FK ke `auth.users` | 20 | **tidak berubah** — tabel ikut pindah | 4 |
| Extension khusus Supabase | **0** | — | — |

Sandi di GoTrue disimpan sebagai bcrypt (`$2a$10$…`), jadi bisa diverifikasi
langsung. **Tidak ada user yang perlu reset sandi.** Identitas Google ada di
`auth.identities.provider_id` dan ikut dipindah.

---

## Cara melanjutkan

1. Lihat tabel status. Ambil fase pertama yang belum ✅.
2. Kerjakan **satu fase**, penuhi kriteria selesainya, commit, centang tabelnya
   dalam commit yang sama.
3. Kalau kenyataan berbeda dari dokumen ini, perbaiki dokumen ini di commit itu
   juga.

**Aturan tes yang mengikat seluruh rencana:**

- `tests/db/*` yang menguji SQL (RLS, grant, trigger, constraint, skema) **tidak
  boleh diubah** untuk membuat fase mana pun hijau. Kalau merah, kodenya yang
  salah.
- Tes yang menguji API Supabase (`auth-http`, `storage-http`, `rls-storage`)
  **di-port, bukan dihapus**: setiap asersinya ditulis ulang melawan endpoint
  baru. Sebuah asersi hanya boleh hilang kalau perilakunya sengaja dibuang, dan
  alasannya dicatat di fase itu.
- Snapshot `rls-surface` hanya diperbarui dengan sadar (`-u`), dan diff-nya
  disebut di pesan commit.

---

## Status

| Fase | Isi | Ukuran | Status |
|---|---|---|---|
| 0 | Prasyarat, keputusan, dan ukuran data produksi | S | 🟡 keputusan ✅, ukuran produksi belum |
| 1 | Lapisan data sendiri di atas Postgres Supabase yang sama | **L** | ✅ |
| 2 | Storage sendiri (disk + URL bertanda) | M | ✅ |
| 3 | Auth sendiri (sesi, sandi, Google) | **L, paling berisiko** | ⬜ |
| 4 | Postgres pindah ke server sendiri | M | ⬜ |
| 5 | Cutover produksi | S, butuh jendela pemeliharaan | ⬜ |
| 6 | Bersih-bersih & penghapusan project Supabase | S | ⬜ |

**Urutannya tidak bisa dibalik di satu titik:** database pindah **paling
akhir**. GoTrue dan storage-api menempel ke Postgres Supabase (skema `auth` milik
`supabase_auth_admin`, skema `storage` milik storage-api), jadi Postgres baru bisa
pergi setelah keduanya tidak dipakai lagi. Fase 1 tidak bergantung pada apa pun,
jadi ia duluan dan yang paling besar.

---

## Fase 0 — prasyarat, keputusan, ukuran

**Keputusan — dicatat 2026-09-21 (Adam):**

1. **Rollout produksi tidak diperlukan dulu.** Belum ada user sungguhan, jadi
   produksi tidak perlu disehatkan sebelum rencana ini jalan. Konsekuensinya
   melegakan dua fase: di Fase 3, logout massal saat pindah auth tidak merugikan
   siapa pun, dan di Fase 5 jendela pemeliharaan tidak kritis.

2. **App lain yang dulu berbagi database ini sudah pensiun dan dibuang.**
   `20260921000000_drop_planning_poker_texas_poker.sql` membuang tabel, fungsi,
   dan trigger-nya — termasuk trigger di `auth.users` yang ikut jalan di setiap
   pendaftaran aplikasi ini. Publication `supabase_realtime` kini kosong: **tidak
   ada lagi yang membutuhkan Realtime**, dan tidak ada app lain yang ikut putus
   saat Supabase dicabut.

3. **File disimpan di disk server** (`/srv/storage/<bucket>/…`), dilayani Caddy
   untuk yang publik. Backup jadi tanggung jawab kita (Fase 4).

4. **Client OAuth Google dibuat sendiri** di Google Cloud Console. Yang
   didaftarkan: *Authorized redirect URI* `https://<domain-kanonik>/auth/callback`
   dan `http://127.0.0.1:3000/auth/callback` untuk lokal. Cukup itu — `?sf=` di
   `lib/oauth-return.ts` meneruskan kode ke storefront lain. Client ID & secret
   masuk `.env.production` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) di Fase 3.

**Masih terbuka:**

5. **Ukur data produksi** (baca-saja, butuh koneksi database produksi):

   ```sql
   select count(*) from auth.users;
   select provider, count(*) from auth.identities group by 1;
   select bucket_id, count(*), pg_size_pretty(sum((metadata->>'size')::bigint))
     from storage.objects group by 1;
   -- baris yang menyimpan URL storage Supabase (harus ditulis ulang di Fase 2):
   select 'lp_landing_pages' t, count(*) from lp_landing_pages
    where concat_ws(' ', html_content, thumbnail_url, thumbnail_landscape_url,
                    preview_url, preview_url_dark) like '%supabase.co/storage%'
   union all select 'lp_sites', count(*) from lp_sites
    where concat_ws(' ', logo_url, icon_url) like '%supabase.co/storage%'
   union all select 'lp_profiles', count(*) from lp_profiles
    where avatar_url like '%supabase.co/storage%';
   ```

   Dengan belum adanya user sungguhan, yang benar-benar menentukan di sini
   adalah **volume file** (ruang disk server) dan jumlah URL yang harus ditulis
   ulang di Fase 2.

**Selesai kalau:** angka produksi di atas tertulis di sini.

---

## Fase 1 — lapisan data sendiri ✅

**Kenyataan berbeda dari rencana, dan rencananya diperbaiki.** Rencana awal
menulis ulang 261 query ke Kysely, modul per modul. Pengukuran sebelum mulai
menunjukkan API supabase-js yang benar-benar dipakai **kecil dan tertutup**:
`select/insert/update/upsert/delete`, 10 filter, `order/range/limit`,
`single/maybeSingle`, `count`, 5 embed, 2 RPC. Jadi yang diganti adalah
**mesinnya**, bukan pemanggilnya: `lib/supabase/{server,admin}.ts` dan
`lib/supabase/anon.ts` (baru) sekarang mengembalikan objek dengan bentuk yang
sama, dijawab oleh `lib/backend/` — SQL langsung ke Postgres lewat
`withRls()`. **Nol dari 77 file pemanggil diubah** untuk bagian query.

**Kenapa ini lebih aman, bukan sekadar lebih cepat:** mesinnya membangun JSON
persis seperti PostgREST (`json_agg`, `json_populate_recordset`), sehingga
kesamaannya bisa **dibuktikan**. `tests/db/adapter-diff.test.ts` menjalankan
setiap bentuk query yang dipakai kode lewat PostgREST asli dan lewat mesin baru,
pada database dan identitas yang sama, lalu membandingkan `data`, `count`, dan
kode error: 25/25 identik — tipe numeric/bigint/timestamptz/uuid[]/jsonb, semua
filter, `.or()` dengan negasi, keempat jenis embed (termasuk `!inner` +
filter kolom embed dan petunjuk FK), `single/maybeSingle` + `PGRST116`,
penolakan RLS `42501`, pelanggaran unik `23505`, upsert, RPC. Mutasi satu
operator (`neq` → `=`) membuatnya merah.

**Yang dibangun:**

| File | Isi |
|---|---|
| `lib/backend/pool.ts` | satu pool `pg` per proses (`DATABASE_URL`) |
| `lib/backend/rls.ts` | `withRls(who, fn)` — transaksi + `set_config('role')` + klaim JWT |
| `lib/backend/grammar.ts` | parser select & filter `.or()` gaya PostgREST |
| `lib/backend/query.ts` | builder berbentuk supabase-js → SQL |
| `lib/backend/schema.ts` | FK, kolom json, PK, fungsi void — dibaca sekali |
| `lib/supabase/anon.ts` | pengganti ±25 client anon yang dibuat sendiri-sendiri |

- **Identitas pemanggil** diverifikasi lewat `auth.getUser()` (GoTrue, sampai
  Fase 3) **sekali per access token** lalu diingat — tidak pernah dari
  `getSession()`, yang cuma membaca cookie yang bisa dipalsukan.
- **`middleware.ts` → `proxy.ts`** (konvensi Next 16). Diperiksa dari kode Next
  16.1.6 sendiri: file `proxy` dijalankan di runtime **Node**, `middleware` di
  Edge. `lib/missing-record.ts` tadinya bicara ke PostgREST dengan `fetch` dari
  Edge; sekarang bertanya ke Postgres sebagai `anon`, dengan batas waktu dan
  gagal-terbuka yang sama. Ini juga yang memungkinkan validasi sesi di proxy
  pada Fase 3.
- `tests/db/with-rls.test.ts`: dengan pool dipaksa **satu** koneksi, identitas
  user / anon / service_role tidak pernah bocor ke pemanggil berikutnya —
  termasuk setelah transaksi gagal di tengah.

**Verifikasi:** `tsc` bersih, `next build` lulus (tidak ada `pg` di bundle
browser; proxy dibangun untuk Node), 143 tes murni + 218 tes database lolos,
dan aplikasi dijalankan sungguhan: 11 halaman publik + 21 halaman/endpoint panel
sebagai Company menjawab 200 tanpa satu error di log, `/api/admin/users`
mengembalikan data, redirect sesi & guard 404 berperilaku sama.

**Selesai:** `grep rest/v1` = 0; tidak ada client supabase-js yang melayani
`.from()`/`.rpc()`. `.auth` dan `.storage` masih Supabase — Fase 2 dan 3.

---

## Fase 2 — storage sendiri ✅

**Tujuan:** `.storage` tidak lagi bicara ke Supabase. File ada di disk server.

Sama seperti Fase 1, bentuk API-nya dipertahankan (`storage.from(b).upload/
download/remove/list/createSignedUrl/getPublicUrl`), jadi ±40 pemanggil tidak
disentuh. Yang berganti adalah apa yang ada di baliknya.

| File | Isi |
|---|---|
| `lib/backend/storage.ts` | bucket (batas ukuran & jenis, sama dengan konfigurasi Supabase), disk di `STORAGE_ROOT`, **policy `storage.objects` ditulis ulang di `allowed()`**, URL bertanda HMAC, `serveFile()` |
| `app/storage/v1/object/public/[bucket]/[...path]` | file publik (bucket publik saja) |
| `app/storage/v1/object/sign/[bucket]/[...path]` | file privat, hanya dengan token `exp.sig` yang sah |
| `app/api/storage/object/[bucket]/[...path]` | `PUT` unggahan dari browser, sebagai user yang login |
| `app/api/storage/remove` | hapus dari browser, sebagai user yang login |
| `lib/supabase/client.ts` | `.storage` browser → dua route di atas |
| `scripts/storage-migrate.mjs` | `export` (Supabase → disk, fetch biasa tanpa SDK, idempoten) dan `rewrite` (URL lama → host baru di **setiap** kolom teks/jsonb tabel `lp_`, ditemukan dari katalog) |

**Keputusan yang menyimpang dari rancangan awal, dan alasannya:**

- **File publik dilayani app, bukan Caddy.** Satu jalur kode untuk publik dan
  privat, Range request dan header keamanan diuji di satu tempat. Caddy bisa
  mengambil alih nanti kalau bebannya terukur — path-nya sudah sama.
- **URL di database tetap absolut** (`NEXT_PUBLIC_SITE_URL/storage/v1/…`), bukan
  relatif. Email, og:image, dan JSON-LD butuh URL absolut, dan helper
  `assetUrl()` berarti menyentuh setiap pembaca. Masalah font lintas domain yang
  jadi alasan URL relatif diselesaikan dengan `Access-Control-Allow-Origin: *`
  pada file publik.
- **Konten aktif (HTML/SVG/XML) disajikan dengan `Content-Security-Policy:
  sandbox`** + `nosniff`. Dulu file penjual tinggal di origin Supabase; sekarang
  satu origin dengan aplikasi, jadi HTML unggahan penjual tanpa sandbox bisa
  membaca apa pun yang bisa dibaca aplikasi.
- **Route unggahan `/api/storage/object/…`**, bukan `/api/upload/<bucket>` — path
  mengikuti bentuk storage-api supaya shim browser tetap tipis.
- `rls-storage.test.ts` dan `storage-http.test.ts` **belum** dipensiunkan:
  keduanya masih menguji Supabase Storage yang masih hidup sampai cutover, dan
  jadi pembanding untuk tes port-nya. Pensiun di Fase 4 bersama stack lokal
  Supabase.
- `scripts/migrate-storage.mjs` (salin antar project Supabase) dihapus —
  digantikan `storage-migrate.mjs export`.

**Tes:**

- `tests/db/storage-own.test.ts` (20): asersi `storage-http.test.ts` di-port ke
  route baru, route handler di-import langsung — penjual boleh, customer tidak,
  folder orang lain tidak, di atas batas & jenis salah ditolak, bucket privat
  tertutup tanpa token, `publisher-kyc`/`hiring-cv` hanya service. Ditambah:
  token kedaluwarsa / diubah satu karakter → 403, path traversal ditolak,
  header sandbox, Range 206/416, list. Mutasi (hapus syarat `lp_can_sell`,
  lewati `verifyToken`) → 3 merah.
- `tests/db/storage-migrate.test.ts` (4): objek yang ditaruh di Supabase Storage
  keluar di disk byte-per-byte sama; jalan kedua tidak menyalin apa pun; uji
  kering tidak mengubah; `--apply` menulis ulang kolom biasa, HTML, dan teks JSON
  sampai tidak ada yang tersisa.
- Dijalankan sungguhan (`pnpm dev`, cookie sesi): anon unggah → 403, penjual
  unggah ke foldernya → 200, folder orang lain → 403, GET publik → 200 +
  `nosniff`, bucket privat lewat URL publik → 404, hapus → 404 sesudahnya;
  `/api/download/<slug>` sesudah beli → redirect ke URL bertanda → 200
  `no-store`, token diubah → 403, tanpa login → `/login`.

**Verifikasi:** `tsc` bersih, `next build` lulus, 143 tes murni + 242 tes
database lolos.

**Sisa untuk cutover (Fase 5):** `export` dari project produksi, lalu `rewrite
--from https://<ref>.supabase.co --to https://<domain kanonik> --apply`.
Sampai itu, baris lama tetap menunjuk Supabase (makanya `**.supabase.co` masih
di `images.remotePatterns`).

**Jalan mundur:** file lama tetap ada di Supabase sampai Fase 6. Kembalikan
kodenya dan jalankan `rewrite` ke arah sebaliknya.

---

## Fase 3 — auth sendiri

**Tujuan:** tidak ada lagi `supabase.auth`. GoTrue berhenti dipanggil.

**Bentuknya:**

- **Tabel user tetap `auth.users`**, baris yang sama, id yang sama, hash bcrypt
  yang sama. Aplikasi membaca dan menulisnya langsung. Karena itu 20 FK dan
  trigger `lp_handle_new_user` tidak berubah. `auth.identities` tetap sumber
  identitas Google.
- **Sesi: token opak, bukan JWT.** 32 byte acak di cookie `httpOnly; Secure;
  SameSite=Lax`, disimpan sebagai sha256 di `app_auth.sessions` (skema sendiri,
  karena skema `auth` masih milik GoTrue sampai Fase 4). Masa berlaku bergeser
  (sliding), 30 hari. Ini menghapus seluruh kontrak refresh token dan penulisan
  ganda cookie request/response di `lib/supabase/proxy.ts`. Middleware cukup
  memeriksa ada tidaknya sesi.
- **Sandi:** `bcryptjs` (JS murni, tanpa native build, jadi `allowBuilds` tidak
  bertambah). Memverifikasi `$2a$10$` lama apa adanya.
- **Google:** `arctic` (OAuth 2 + PKCE). Alur `?sf=` tidak berubah: callback
  kanonik meneruskan `code` ke domain asal, karena verifier PKCE-nya cookie milik
  domain itu. `resolveReturnHost` dan tesnya tetap.
- **Ban:** kolom `auth.users.banned_until` yang sudah ada. Login dan validasi sesi
  menolaknya, dan ban **mencabut semua sesi aktif** user itu. GoTrue dulu hanya
  menolak login baru.
- **Pembatasan percobaan login:** GoTrue punya batas per IP. Ganti dengan
  `lp_signup_attempts` yang sudah ada, diperluas ke login. Tanpa ini,
  brute force sandi terbuka.
- **Hapus user:** `delete from auth.users`, lalu cascade berjalan persis seperti
  sekarang (sudah dikunci di `logic.test.ts`).

**Tes:**

- `auth-http.test.ts` **di-port**. Perilaku yang wajib tetap: signup langsung
  mendapat sesi, profil lahir `customer` dan belum terverifikasi, sandi < 6 ditolak,
  sandi salah ditolak, ban menutup login, `/panel` tanpa sesi → `/login`, `/login`
  dengan sesi → `?next=` yang aman, `//evil.example` ditolak, halaman publik tidak
  menyentuh sesi. Yang **sengaja hilang**, dengan alasan: rotasi refresh token dan
  pembaruan access token di middleware. Sesi opak tidak punya keduanya. Penggantinya:
  sesi kedaluwarsa → `/login`; sesi yang dicabut (logout di tab lain, ban) langsung
  tidak berlaku.
- Tes baru: login dengan hash `$2a$10$` hasil GoTrue sungguhan (diambil dari
  database lokal) berhasil; sesi user yang di-ban mati seketika; percobaan ke-N
  dari satu IP ditolak.

**Selesai kalau:** `grep -rE 'supabase\.auth|auth\.admin' app lib components`
kosong, dan seorang user yang dibuat lewat GoTrue sebelum fase ini bisa login
dengan sandi lamanya.

**Risiko & jalan mundur:** fase paling berbahaya, karena setiap kesalahan di sini
adalah pintu yang terbuka atau semua orang terkunci. Deploy di belakang flag
`AUTH_PROVIDER=supabase|own`. Keduanya membaca `auth.users` yang sama, jadi bisa
dibalik tanpa migrasi data. **Semua user logout sekali** saat flag dibalik.
Umumkan.

---

## Fase 4 — Postgres pindah ke server sendiri

**Tujuan:** database jalan di container `postgres:17-alpine` di server, di
samping app dan Caddy.

- **Baseline, bukan replay 91 migration.** Migration lama menyebut `storage.*`,
  `supabase_realtime` dan `supabase_auth_admin` — tidak ada di Postgres polos —
  serta membuat lalu membuang tabel app yang sudah pensiun (`20260921000000`). Buat `00000000000000_baseline.sql` dari
  `pg_dump --schema-only` skema `public` (hanya `lp_*`) + skema `auth` yang dipakai.
  Migration lama dipindah ke `supabase/migrations/_archive/` sebagai riwayat.
- **Shim — hal kecil yang membuat semua policy tetap sama:**

  ```sql
  create role anon nologin;  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'sub', '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::json->>'role'
  $$;
  -- auth.users / auth.identities: hanya kolom yang dipakai aplikasi.
  -- app_auth.sessions dipindah ke auth.sessions.
  ```

  Role login aplikasi (`app`) diberi keanggotaan di ketiga role itu. Itu yang
  membuat `set local role` bekerja.
- **Runner migration sendiri** (`scripts/migrate.mjs`, ±50 baris): menerapkan
  file SQL berurutan dan mencatat versi di tabel yang sama
  (`supabase_migrations.schema_migrations`, diganti nama nanti). Format file
  migration tidak berubah.
- **Lokal & CI jadi satu container.** `docker compose` dengan `postgres:17-alpine`
  menggantikan 5–8 container stack Supabase. CI memakai `services: postgres`.
  `tests/db/global-setup.ts` membaca `DATABASE_URL` alih-alih `supabase status`.
- **Backup — sekarang tanggung jawab kita.** `pg_dump` terjadwal + salinan
  `/srv/storage` ke luar server (restic/rclone). **Latihan restore** ke database
  kosong, lalu `pnpm test:db` di atasnya. Backup yang belum pernah di-restore
  belum terbukti ada.

**Tes — gerbang terpenting di seluruh rencana:** seluruh `pnpm test:db` hijau
**melawan Postgres polos** yang dibangun dari baseline + shim. Kalau lolos, model
keamanannya terbukti tidak bergantung pada Supabase. Snapshot `rls-surface`
harus identik, kecuali policy storage yang sudah pensiun di Fase 2.

**Selesai kalau:** CI hijau dengan satu container Postgres, dan latihan restore
tercatat di sini.

---

## Fase 5 — cutover produksi

Satu jendela pemeliharaan. Lamanya ditentukan angka di Fase 0 (terutama besar
file).

1. Salin file lebih dulu, di luar jendela (rsync inkremental; ulangi di dalam
   jendela untuk delta-nya).
2. **Buka jendela:** halaman pemeliharaan, tulis dibekukan.
3. `pg_dump` data `lp_*` + `auth.users` + `auth.identities` dari Supabase →
   restore ke Postgres server.
4. Delta file terakhir; jalankan penulisan ulang URL; periksa hitungan objek dan
   query `supabase.co` = 0.
5. Ganti env (`DATABASE_URL`, rahasia HMAC, client Google), `docker compose up -d
   --build`.
6. **Uji asap di produksi:** daftar akun baru, login sandi lama, login Google,
   ambil produk gratis, beli produk berbayar (Duitku sandbox kalau bisa), unduh,
   unggah thumbnail, chat MbahGPT dengan lampiran, simpan setelan sebagai Agent.
7. **Tutup jendela.**

**Jalan mundur:** project Supabase **tidak dihapus** dan tidak diubah selama
fase ini. Selama belum ada tulisan baru yang penting, kembali = kembalikan env
dan deploy ulang. Sesudah ada tulisan baru, jalan mundurnya adalah dump balik.
Karena itu jendela rollback dibatasi (lihat Fase 6).

---

## Fase 6 — bersih-bersih

- Hapus `@supabase/supabase-js`, `@supabase/ssr`, dan devDependency `supabase`
  (CLI), serta `lib/supabase/*`, `supabase/config.toml`, dan env
  `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` di `.env.example`,
  Dockerfile, dan compose.
- `schema-contract.test.ts` pensiun (tipe hasil generate yang menjaganya).
  `rls-surface` dan tes perilaku RLS tetap.
- Tulis ulang bagian Supabase di `CLAUDE.md`, `docs/architecture.md`,
  `docs/technical.md`, dan skill `run-local`.
- **Setelah 30 hari tanpa rollback:** backup terakhir project Supabase disimpan
  di luar server, lalu project-nya dihapus. Keputusan Adam, dilakukan tangan.

**Selesai kalau:** `grep -ri supabase` di kode aplikasi hanya menemukan riwayat
di `_archive/` dan dokumen, dan tagihan Supabase berhenti.

---

## Hasil akhirnya

| | Sekarang (hosted) | Sesudah |
|---|---|---|
| Container di server | app + Caddy | app + Caddy + Postgres (~90 MB) |
| File | di Supabase | disk server + backup di luar |
| Jalan browser ke database | PostgREST (anon key di bundle) | **tidak ada** |
| Aturan keamanan | RLS + grant + trigger | **sama persis**, tetap diuji |
| Tipe query | ditulis tangan, tak diperiksa | di-generate dari skema |
| Stack tes lokal/CI | 5–8 container Supabase | 1 container Postgres |
| Tanggung jawab baru | — | backup, patch Postgres, rate limit login |

Satu hal perlu dicatat jujur: Supabase hosted memakai 0 MB di server sendiri.
Rencana ini **menambah** Postgres (±90 MB) dan disk untuk file di server. Yang
hilang adalah biaya langganan, ketergantungan vendor, dan seluruh permukaan
PostgREST.
