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
| 0 | Prasyarat, keputusan, dan ukuran data produksi | S | ⬜ |
| 1 | Lapisan data sendiri (Kysely) di atas Postgres Supabase yang sama | **L** | ⬜ |
| 2 | Storage sendiri (disk + Caddy + URL bertanda) | M | ⬜ |
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

**Harus beres sebelum satu baris kode diubah:**

1. **Rollout yang tertunda naik dulu.** Tujuh migration `20260919*` dan kode
   aplikasinya (lihat Fase 0 rencana tes). Rencana ini dibangun di atas produksi
   yang sehat. Pendaftaran di produksi mati sampai itu naik.

2. **Nasib planning-poker (`pp_`) dan texas-poker (`tp_`).** Keduanya tinggal di
   database yang sama, memakai `auth.users` yang sama, dan tabelnya ada di
   publication `supabase_realtime`. **Realtime dipakai mereka, bukan aplikasi
   ini.** Mencabut Supabase sepenuhnya memutus keduanya. Pilihan:
   - (a) keduanya sudah mati → tabel `pp_`/`tp_` dibuang di Fase 4;
   - (b) masih hidup → pindahkan ke project/database sendiri **sebelum** Fase 4,
     termasuk akun penggunanya.

   Keputusan Adam. Rencana ini mengasumsikan (a) sampai dikatakan lain.

3. **Tujuan file.** Rekomendasi: **disk server** (`/srv/storage/<bucket>/…`),
   karena paling hemat resource (nol container tambahan) dan Caddy bisa melayani
   file publik tanpa menyentuh Node. Konsekuensinya: **backup jadi tanggung jawab
   kita** (lihat Fase 4). Alternatifnya object storage S3-compatible (R2/B2):
   backup-nya diurus penyedia, tapi ada biaya dan ketergantungan baru. Keputusan
   Adam; rencana ini mengasumsikan disk.

4. **Client OAuth Google sendiri.** Sekarang client Google dikonfigurasi di
   dashboard Supabase, dengan redirect ke domain Supabase. Buat client baru di
   Google Cloud Console dengan redirect `https://<domain-kanonik>/auth/callback`.
   Cuma satu redirect yang dibutuhkan: mekanisme `?sf=` di `lib/oauth-return.ts`
   tetap meneruskan kode ke domain asal.

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

   Angkanya menentukan jendela pemeliharaan di Fase 5 dan ruang disk yang
   dibutuhkan server.

**Selesai kalau:** keempat keputusan tercatat di sini, dan angka produksi tertulis
di bawah.

---

## Fase 1 — lapisan data sendiri

**Tujuan:** tidak ada lagi `.from("lp_…")`. Setiap query lewat Kysely + `pg`,
langsung ke **Postgres Supabase yang sama**. GoTrue dan storage-api belum
disentuh.

**Bentuknya:**

```ts
// lib/db/index.ts
export async function withRls<T>(
  who: "anon" | "service_role" | { uid: string },
  fn: (tx: Transaction<DB>) => Promise<T>,
): Promise<T>
```

Isinya persis `as()` dari harness tes: transaksi, `set local role`, klaim JWT.
Identitas `{ uid }` diambil dari `supabase.auth.getUser()` yang masih ada. Di Fase 3
sumbernya berganti, `withRls` tidak.

- **Tipe dihasilkan dari database** (`kysely-codegen`) dan di-commit. Ini sekaligus
  menutup celah "tidak ada generated type" yang dicatat rencana sebelumnya:
  kolom yang hilang jadi error kompilasi, tidak lagi 500 saat runtime.
  `schema-contract.test.ts` tetap dipertahankan sampai Fase 6 sebagai jaring
  kedua.
- **Koneksi:** connection string langsung ke Postgres Supabase (pooler mode
  transaksi). `set local` berlaku per transaksi, jadi aman di pooler. Kysely
  memakai unnamed statement, jadi tidak bentrok dengan pooler.
- **Pola strangler, modul per modul.** Supabase-js dan Kysely hidup berdampingan
  karena keduanya bicara ke database yang sama. Urutan yang disarankan, dari yang
  paling terisolasi: analytics → reviews/likes → categories → site-settings → sites
  → landing-pages → purchases/sales → profiles/admin. Satu modul = satu commit
  yang bisa di-deploy.
- **Pemetaan idiom PostgREST:** `.maybeSingle()` → `executeTakeFirst()`,
  `.single()` → `executeTakeFirstOrThrow()`, `count: "exact", head: true` →
  `count(*)`, `.upsert(…, { onConflict })` → `onConflict().doUpdateSet()`,
  `.or("a.eq.x,b.ilike.%q%")` → `where(eb => eb.or([...]))`. Lima embedded select
  (termasuk yang pakai petunjuk FK `!purchases_landing_page_id_fkey`) → join
  eksplisit. Dua RPC → `sql\`select lp_track_session(…)\``.
- **`lib/site-scope.ts`** (`.or()` untuk multi-tenant, dipakai di 10 file) ditulis
  ulang sebagai helper Kysely **duluan**, karena semua modul lain bergantung
  padanya.

**Tes:**

- Semua `tests/db` harus tetap hijau **tanpa diubah**.
- Tes baru: `tests/db/with-rls.test.ts` membuktikan `withRls` tidak bocor antar
  request. Transaksi A sebagai user X tidak boleh meninggalkan role atau klaim
  untuk transaksi B di koneksi pool yang sama. Ini bug terburuk yang mungkin
  muncul di fase ini, dan tidak kelihatan di layar.

**Selesai kalau:**

```bash
grep -rE '\.from\("lp_' app lib components | wc -l   # 0
grep -rE '\.rpc\(' app lib components | wc -l        # 0
```

dan `pnpm test` + `pnpm test:db` hijau.

**Jalan mundur:** per modul. Revert satu commit mengembalikan modul itu ke
supabase-js.

---

## Fase 2 — storage sendiri

**Tujuan:** tidak ada lagi `.storage`. File ada di disk server.

- **Letak:** `/srv/storage/<bucket>/<path>`, volume Docker yang di-mount ke app
  dan Caddy. Bentuk path-nya **sama** dengan Supabase (`<uid>/…`), supaya
  migrasinya cuma salin.
- **File publik** (`landing-assets`): dilayani **Caddy langsung** di
  `/storage/v1/object/public/landing-assets/*`. Path yang sama dengan Supabase
  sengaja dipakai: URL lama cukup diganti host-nya.
- **File privat** (`landing-downloads`, `chat-attachments`, `publisher-kyc`,
  `hiring-cv`): hanya lewat route aplikasi, dengan **URL bertanda HMAC**
  (`path + kedaluwarsa`, rahasia di env). Ini pengganti `createSignedUrl`, dan
  pemeriksa pembeliannya tetap di tempat yang sama (`lib/actions/downloads.ts`).
- **Unggahan:** browser mem-POST ke route handler (`/api/upload/<bucket>`) yang
  menulis ke disk secara streaming. **Aturan dari `storage-http.test.ts` pindah
  ke sini:** batas ukuran per bucket, daftar jenis file, penulis harus
  `lp_can_sell()` untuk bucket penjual, folder `<uid>/` harus milik pemanggil.
  `lib/upload-client.ts` dan `lib/templates/mbahgpt/upload.ts` berhenti bicara ke
  Supabase.
- **URL di database:** host lama ditulis ulang menjadi **path relatif**
  (`/storage/v1/object/public/…`), supaya setiap storefront melayani file dari
  domainnya sendiri. Ini menghindari masalah CORS font di bundle situs yang
  memakai `<base href>`. Tempat yang butuh URL absolut (og:image, email, JSON-LD)
  memakai helper `assetUrl(path, origin)`. `next.config.ts` → `images.remotePatterns`
  berhenti menyebut `**.supabase.co`.
- **Migrasi file:** `scripts/migrate-storage.mjs` sudah ada (mengunduh lewat SDK).
  Ubah supaya menulis ke disk dan mencocokkan jumlah objek dan byte per bucket
  dengan angka Fase 0.

**Tes:**

- `storage-http.test.ts` **di-port** ke route baru. Asersinya tetap sama:
  penjual boleh, customer tidak, folder orang lain tidak, di atas batas ditolak,
  jenis salah ditolak, file dijual tidak bisa diambil tanpa URL bertanda,
  `publisher-kyc` dan `hiring-cv` tertutup. Route handler diuji dengan
  meng-import-nya langsung (seperti `updateSession` di `auth-http.test.ts`),
  tanpa server.
- `rls-storage.test.ts` pensiun di fase ini, karena policy `storage.objects` tidak
  dipakai lagi. Setiap asersinya harus sudah punya pasangan di tes route.
  Snapshot `rls-surface` diperbarui (policy storage hilang).
- Tes baru: URL bertanda yang **kedaluwarsa** atau **diubah satu karakter**
  ditolak.

**Selesai kalau:** `grep -r '\.storage' app lib components` kosong; query Fase 0
tentang URL `supabase.co/storage` mengembalikan 0 di setiap tabel; jumlah objek
di disk sama dengan di Supabase.

**Jalan mundur:** file lama tetap ada di Supabase sampai Fase 6. Kembalikan
kodenya dan jalankan penulisan ulang URL ke arah sebaliknya.

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
  `supabase_realtime`, `supabase_auth_admin`, dan tabel `pp_`/`tp_`. Semuanya
  tidak ada di Postgres polos. Buat `00000000000000_baseline.sql` dari
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
