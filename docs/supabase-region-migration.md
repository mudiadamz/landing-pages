# Memindahkan Supabase ke Asia Tenggara (Singapore)

Runbook pemindahan project Supabase `admuiux` dari **`ap-northeast-1` (Tokyo)** ke
**`ap-southeast-1` (Singapore)**.

Ditulis 2026-07-30. Angka inventaris di bawah diukur pada tanggal itu — hitung
ulang sebelum eksekusi kalau sudah lewat beberapa minggu.

## Status

**Cutover selesai 2026-07-30.** Produksi (`admuiux.com`) berjalan di Singapore:
function di `sin1`, database di `ap-southeast-1`, terverifikasi lewat probe row
yang hanya ada di database baru.

- [x] **Google provider aktif** — diverifikasi: `/auth/v1/authorize?provider=google`
      membalas 302 ke Google dengan
      `redirect_uri=https://uxizlsoggphacyvtshub.supabase.co/auth/v1/callback`.
- [x] **Login user lama aman** — 20 user punya `email_confirmed_at`, 11 punya hash
      password, 10 punya identity Google.

Sisa (dashboard, belum bisa diotomasi — management token ada di keyring):

- [ ] **`mailer_autoconfirm` masih `false`** (produksi lama `true`).
      Authentication → Sign In / Providers → Email → matikan **Confirm email**.
      **User lama tidak terpengaruh.** Yang kena hanya signup baru: `signUp()`
      tidak mengembalikan session, fallback `signInWithPassword` di
      `lib/actions/auth.ts:74` gagal dengan "Email not confirmed", dan user
      mendarat di `/signup?message=check_email` — plus menerima dua email
      (verifikasi Resend milik sendiri + konfirmasi bawaan Supabase).
- [x] **Site URL + redirect allow-list** — sudah `https://admuiux.com` dan
      `https://admuiux.com/**`. Sempat dibuat `http://` (bukan `https://`), dan
      itulah yang mematikan login Google: Google-nya sendiri benar, tapi
      Supabase menolak `redirect_to` `https://admuiux.com/auth/callback` lalu
      jatuh ke Site URL **tanpa `code`**, sehingga `/auth/callback` tidak pernah
      jalan dan `exchangeCodeForSession` tidak pernah dipanggil.
- [x] **`mailer_autoconfirm` = true** — signup baru langsung dapat session lagi.

Cara cek ulang tanpa akun Google (token bohongan, tidak merusak apa pun):
```bash
curl -s -o /dev/null -D - \
  "https://<ref>.supabase.co/auth/v1/verify?token=x&type=signup&redirect_to=https%3A%2F%2Fadmuiux.com%2Fauth%2Fcallback" \
  | grep -i '^location:'
```
`location` memantulkan `redirect_to` apa adanya → allow-list benar. Kalau
berubah, nilai itulah Site URL dan `redirect_to` sedang ditolak.

**Migrasi selesai.** Semua item cutover hijau.

Project lama `ogjydcyccrnoxdtakizs` **masih hidup dan utuh** — jangan dihapus
minimal satu minggu.

| | |
|---|---|
| Project lama (produksi) | `ogjydcyccrnoxdtakizs` · `admuiux` · `ap-northeast-1` |
| Project baru (kosong, siap) | `uxizlsoggphacyvtshub` · `admuiux-sg` · `ap-southeast-1` |
| Kredensial project baru | `.env.singapore` (gitignored lewat `.env*`, mode 600) |

Selesai:

- [x] Project Singapore dibuat, `ACTIVE_HEALTHY`
- [x] 60 migration di-push — skema `lp_`/`pp_`/`tp_` lengkap, terverifikasi
- [x] 147 file / 62,5 MB storage tersalin; setting bucket (public, size limit,
      MIME allowlist) cocok persis di keempat bucket
- [x] CLI di-link balik ke project produksi

Belum:

- [ ] Google OAuth di project baru + redirect URI baru di Google Cloud Console
- [ ] Auth settings: Site URL, redirect list, `mailer_autoconfirm`, template email
- [ ] Staging env di tiga project Vercel
- [ ] **Cutover** (bagian "Hari-H" di bawah) — belum dijadwalkan

## Aturan yang paling penting

> **Pindahkan database DAN Vercel functions bersamaan, atau jangan pindah sama sekali.**

`vercel.json` saat ini mengunci functions di `hnd1` (Tokyo), satu region dengan
database — jadi query dari server ke DB praktis gratis (~1–3 ms). Tiga skenario:

| Skenario | Browser → function | Function → DB (×~6 query/halaman) | Hasil |
|---|---|---|---|
| Sekarang (Tokyo + `hnd1`) | jauh | ~1–3 ms | baseline |
| **DB pindah saja**, functions tetap `hnd1` | jauh (tak berubah) | **lintas region, ×6** | **jauh lebih lambat** |
| DB pindah **dan** functions → `sin1` | lebih dekat ke Indonesia | ~1–3 ms | lebih cepat |

Memindahkan salah satunya saja adalah regresi, bukan optimasi. Skenario tengah
adalah kesalahan yang paling gampang terjadi kalau `vercel.json` terlupa.

## Supabase tidak punya "pindah region"

Project Supabase di-provision ke satu region seumur hidupnya. Satu-satunya jalan
adalah **membuat project baru di region tujuan lalu migrasi isinya**
([docs](https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z)).
Project Transfer hanya memindah antar organisasi, bukan antar region
([docs](https://supabase.com/docs/guides/platform/project-transfer)).

Konsekuensinya: **project ref berubah**, sehingga URL, anon key, service role
key, dan JWT secret ikut berubah.

## Ruang lingkup (ini bukan project tunggal)

Satu Supabase ini melayani **tiga aplikasi** lewat prefix tabel — lihat migration
`20260621000000_pp_merge.sql`, `20260621000100_tp_merge.sql`,
`20260621000200_lp_rename.sql`. Semua ikut terdampak:

| Prefix | App | Bukti |
|---|---|---|
| `lp_` | landing_pages | 17 produk, 19 pembelian, 20 profil |
| `pp_` | planning-poker | `pp_rooms` 9 baris |
| `tp_` | texas-poker | tabel `tp_*` ada (hasil merge) |

Inventaris per 2026-07-30:

- `auth.users`: **20**
- Baris data terbesar: `lp_product_events` 4.506, `lp_page_events` 1.210, `lp_sessions` 1.098
- Storage: **147 file, 62,5 MB** di 4 bucket
  (`landing-assets` 22,9 MB publik · `landing-downloads` 39,4 MB privat ·
  `publisher-kyc` 0,3 MB · `hiring-cv` <0,1 MB)
- Edge Functions: **tidak ada** (`supabase functions list` → `[]`)
- Migration lokal: 60 file

Datanya kecil. Yang bikin repot bukan volume, tapi jumlah tempat yang menyimpan
kunci lama.

## Yang TIDAK ikut terbawa oleh dump database

Ini sumber kegagalan paling sering — semuanya harus dibuat ulang manual:

1. **Isi file Storage.** Dump membawa baris `storage.objects` (metadata) tapi
   bytes-nya ada di S3. Restore tanpa menyalin file = daftar file lengkap yang
   semuanya 404. Gunakan `scripts/migrate-storage.mjs`.
2. **Setting bucket** — flag public, batas ukuran, allowlist MIME.
3. **Kredensial Google OAuth.** Client ID/secret harus dimasukkan ulang di
   dashboard project baru, **dan** redirect URI baru
   `https://<ref-baru>.supabase.co/auth/v1/callback` harus didaftarkan di Google
   Cloud Console. Kalau langkah ini terlewat, login Google mati total.
4. **Auth settings** — Site URL, daftar redirect yang diizinkan,
   `mailer_autoconfirm`, rate limit, template email, konfigurasi SMTP.
5. **Session yang sedang berjalan.** JWT secret baru → semua refresh token lama
   tidak valid. 20 user harus login ulang. Password tetap jalan (hash ikut
   terbawa di `auth.users`), yang hilang cuma sesinya.

## Urutan eksekusi

### Sebelum hari-H (tanpa downtime)

1. **Buat project baru** di dashboard, region **Singapore (`ap-southeast-1`)**,
   Postgres 17 (samakan dengan `17.6.1` yang sekarang).
2. **Terapkan skema** (perintah persis yang dipakai):
   ```bash
   set -a; . ./.env.singapore; set +a
   supabase link --project-ref uxizlsoggphacyvtshub --password "$SG_DB_PASSWORD"
   SUPABASE_DB_PASSWORD="$SG_DB_PASSWORD" supabase db push --include-all --yes
   supabase link --project-ref ogjydcyccrnoxdtakizs   # WAJIB: link balik ke produksi
   ```
   Link balik itu bukan formalitas — kalau lupa, `supabase db push` berikutnya
   menembak project yang salah.
3. **Salin bulk storage** (idempoten, aman diulang — dry run kalau tanpa `--apply`):
   ```bash
   set -a; . ./.env.local; . ./.env.singapore; set +a
   export OLD_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" OLD_SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
   export NEW_SUPABASE_URL="$SG_SUPABASE_URL"        NEW_SERVICE_KEY="$SG_SERVICE_KEY"
   node scripts/migrate-storage.mjs --apply
   ```
4. **Siapkan dashboard project baru**: Google OAuth, Site URL, redirect list,
   `mailer_autoconfirm`, template email.
5. **Siapkan (jangan aktifkan) env baru** di ketiga project Vercel.

### Hari-H (jendela downtime, ~15–30 menit)

Pilih jam sepi dan **hentikan iklan dulu**. Risiko utamanya bukan halaman down,
tapi **callback Duitku yang datang di tengah jendela**: pembeli sudah bayar,
baris `lp_purchases` tidak pernah tercatat. Itu kehilangan uang yang sunyi.

1. Aktifkan maintenance / hentikan traffic tulis.
2. Dump data dari project lama, restore ke project baru
   ([panduan CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase)).
   CLI sudah punya kredensial ter-cache untuk project lama, jadi tidak ada prompt
   password. Diuji 2026-07-30: 6,7 MB, 45 tabel, 20 user di `auth.users` lengkap
   dengan hash password dan identity Google.
   ```bash
   supabase db dump --linked --data-only --use-copy --schema public,auth -f data.sql
   ```
   **Skema `storage` sengaja tidak ikut.** Penyalinan file lewat Storage API sudah
   membuat baris `storage.objects` di project baru; ikut men-dump-nya = tabrakan
   primary key saat restore.

   **Restore WAJIB mematikan trigger.** Dua alasan, keduanya bikin gagal senyap:
   `pg_dump` memperingatkan ada circular foreign key, dan trigger
   `lp_handle_new_user` akan ikut jalan saat baris `auth.users` masuk lalu membuat
   `lp_profiles` duplikat yang bentrok dengan baris `lp_profiles` dari dump.
   ```bash
   { echo 'SET session_replication_role = replica;'; cat data.sql; } \
     | psql "<url-baru>" -v ON_ERROR_STOP=1 --single-transaction
   ```
3. Sinkronkan delta storage: jalankan ulang `migrate-storage.mjs --apply`.
4. Tukar env di **ketiga** app Vercel: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
5. Ubah region function ke Singapore — di `landing_pages/vercel.json`:
   ```json
   { "$schema": "https://openapi.vercel.sh/vercel.json", "regions": ["sin1"] }
   ```
   planning-poker dan texas-poker belum punya kunci region (default `iad1`,
   Washington) — tambahkan `"regions": ["sin1"]` sekalian; keduanya realtime dan
   paling terasa manfaatnya.
6. **Redeploy ketiganya.** `NEXT_PUBLIC_*` di-inline saat build, jadi mengganti
   env tanpa redeploy tidak berefek apa pun.
7. Verifikasi: login email, login Google, buka satu produk berbayar, unduh ZIP
   (signed URL Storage), kirim satu contact form, cek `/panel/sales` tetap
   menampilkan 19 pembelian.

## Temuan saat cutover (tidak ada di rencana awal)

Empat hal yang baru ketahuan saat benar-benar dijalankan:

1. **URL absolut tersimpan di dalam data.** Ini yang paling berbahaya.
   `thumbnail_url`, `preview_url`, `thumbnail_landscape_url`, `html_content`, dan
   `lp_site_settings.value` menyimpan URL lengkap ke storage project **lama** —
   45 baris di 8 kolom. Dump/restore memindahkannya apa adanya, jadi setelah
   cutover situs masih menarik gambar dari Tokyo. Kelihatan normal sampai project
   lama dihapus, lalu semua gambar mati sekaligus. Sudah ditulis ulang, kecuali
   `lp_received_emails.body_html`/`body_text` (2 baris) yang **sengaja dibiarkan**
   — itu arsip email masuk, mengubah isinya berarti memalsukan rekaman.
   ```sql
   UPDATE lp_landing_pages SET thumbnail_url = replace(thumbnail_url, '<ref-lama>.supabase.co', '<ref-baru>.supabase.co'), … ;
   ```
   Cek ulang seluruh kolom teks sebelum menghapus project lama.
2. **Tabel auth yang ephemeral jangan ikut dipindah.** `TRUNCATE … RESTART
   IDENTITY` gagal di `auth.refresh_tokens` karena sequence-nya milik
   `supabase_auth_admin`, bukan `postgres`. Dan memang tidak perlu: JWT secret
   baru membatalkan semua sesi. Cukup bawa `auth.users` + `auth.identities`;
   20 tabel auth sisanya (sessions, refresh_tokens, flow_state, audit log, SSO,
   MFA, OAuth state) dilewati.
3. **Next.js Data Cache bertahan lintas deployment.** Setelah env ditukar dan
   deploy ulang — bahkan dengan `--force` — halaman masih menyajikan URL project
   lama. Itu Data Cache, bukan build cache dan bukan CDN
   (`x-vercel-cache: MISS`, `age: 0`). Selesai dengan `vercel cache purge`.
   Jangan simpulkan "env belum masuk" sebelum cache dibersihkan.
4. **texas-poker tidak punya project Vercel** — lokal saja. `.env.local`-nya
   bahkan menunjuk project mati `sptnjidvcghqcigfembh`. Sudah diarahkan ke
   project baru. Lima project Vercel lain di org ini dicek: tidak ada yang
   memakai Supabase.

### Rollback

Project lama masih utuh selama belum dihapus. Rollback = kembalikan env dan
`vercel.json` ke nilai lama lalu redeploy. Tulis apa pun yang masuk ke project
baru setelah cutover akan hilang — jadi keputusan rollback harus cepat.

**Jangan hapus project lama minimal satu minggu** setelah cutover.

## Apakah pindah ini sepadan?

Belum diukur. Pengukuran dari mesin dev tidak sah untuk pertanyaan ini: mesin itu
ada di Dubai, dan `*.supabase.co` ada di belakang Cloudflare, jadi angka `curl`
yang keluar adalah latensi ke PoP Cloudflare terdekat — bukan ke origin Tokyo.

Yang bisa dikatakan dengan yakin hanya geografinya: Jakarta–Singapore ~1.000 km,
Jakarta–Tokyo ~5.800 km. Untuk audiens yang hampir seluruhnya Indonesia, arahnya
jelas benar; besarannya belum terbukti.

Ukuran yang layak dipercaya sebelum memutuskan: TTFB `admuiux.com` dari koneksi
Indonesia sungguhan (bukan VPN), atau TTFB per-region di Vercel Analytics.
