# Runbook: pindah dari Supabase ke Postgres di server

Fase 5 dari [`docs/plans/remove-supabase.md`](../plans/remove-supabase.md).
Dijalankan **Adam**, sekali. Setiap perintah di bawah sudah dijalankan persis
seperti tertulis dalam gladi lokal (lihat "Gladi" di akhir) — dengan stack
Supabase lokal sebagai pengganti produksi.

Nilai yang dipakai di bawah:

| Nama | Isi |
|---|---|
| `SUPABASE_URL` | `https://uxizlsoggphacyvtshub.supabase.co` |
| `SUPABASE_DB_URL` | Dashboard → Connect → **Session pooler** (bukan Transaction pooler: pg_dump butuh sesi) |
| `SUPABASE_SERVICE_ROLE_KEY` | yang sekarang ada di `.env.production` |
| `CANONICAL` | `https://admuiux.com` |

Tidak ada user sungguhan (2026-09-21), jadi jendelanya boleh longgar dan semua
orang logout sekali. Kalau itu sudah berubah saat runbook ini dijalankan, umumkan
dulu.

---

## A. Persiapan (kapan saja sebelumnya — tidak mengubah apa pun yang hidup)

1. **Google Cloud Console** → OAuth client yang dipakai Supabase → *Authorized
   redirect URIs*: **tambahkan** `https://admuiux.com/auth/callback`. Jangan hapus
   URI Supabase yang lama (itu jalan mundur). Salin *Client ID* & *Client secret*
   (atau dari Supabase Dashboard → Authentication → Providers → Google).
2. **`.env.production` di server** — tambahkan (nilai acak: `openssl rand -hex 32`;
   **hex saja**, karena dua password ini masuk ke URL koneksi):

   ```
   POSTGRES_PASSWORD=<hex>
   APP_DB_PASSWORD=<hex>
   STORAGE_SIGNING_SECRET=<hex>
   SIGNUP_FORM_SECRET=<hex>        # wajib: dulu jatuh ke service role key
   GOOGLE_CLIENT_ID=…
   GOOGLE_CLIENT_SECRET=…
   ```

   `DATABASE_URL` tidak perlu diisi — compose menetapkannya ke container `db`.
   Variabel `NEXT_PUBLIC_SUPABASE_*` dan `SUPABASE_SERVICE_ROLE_KEY` **biarkan**
   sampai Fase 6 (dipakai langkah C).
3. **Samakan skema Supabase dengan baseline** (dari mesin pengembang, di repo):

   ```sh
   node scripts/supabase-catch-up.mjs "$SUPABASE_DB_URL"          # daftar saja
   node scripts/supabase-catch-up.mjs "$SUPABASE_DB_URL" --apply
   ```

   Ini **menulis ke Supabase produksi**: 7 migration `20260919*`,
   `20260921000000` (buang planning/texas poker) dan `20260922000000`
   (`app_auth`). Aplikasi lama tetap jalan di atasnya. Tanpa langkah ini, impor
   data di C4 gagal karena kolomnya beda — gagal di sana, bukan diam-diam.

## B. Salin file lebih dulu (di server, di luar jendela)

Semua perintah B–C dijalankan dari folder repo di server, dengan isi
`.env.production` dimuat ke shell (beberapa perintah memakai
`$POSTGRES_PASSWORD` dkk. langsung):

```sh
cd /srv/landing_pages
set -a; . ./.env.production; set +a
export SUPABASE_URL=https://uxizlsoggphacyvtshub.supabase.co SUPABASE_DB_URL='<session pooler URL>'
mkdir -p /srv/backups
```

```sh
git rev-parse HEAD > /srv/backups/pre-cutover-commit   # untuk jalan mundur
git pull                                   # commit yang berisi fase 1–5
docker compose --env-file .env.production build
docker compose --env-file .env.production run --rm --no-deps app \
  node scripts/storage-migrate.mjs export \
  --supabase-url "$SUPABASE_URL" --service-key "$SUPABASE_SERVICE_ROLE_KEY" --root /srv/storage
```

Aplikasi lama tidak tersentuh (`run --no-deps` hanya menjalankan satu perintah
di image baru, dengan volume `storage`). Boleh diulang kapan saja — objek yang
sudah tersalin dengan ukuran sama dilewati. Keluarannya jumlah objek & byte per
bucket; catat.

## C. Jendela pemeliharaan

1. **Hentikan aplikasi lama** (tulisan berhenti di sini):

   ```sh
   docker compose --env-file .env.production stop app
   ```

2. **Database baru** — volume kosong → init membuat role `app` → baseline:

   ```sh
   docker compose --env-file .env.production up -d db migrate
   docker compose --env-file .env.production logs migrate    # "diterapkan: 00000000000000_baseline.sql"
   ```

3. **Dump data Supabase** (pg_dump dari dalam container `db`, versi 17 yang sama):

   ```sh
   docker compose --env-file .env.production exec -T db \
     pg_dump "$SUPABASE_DB_URL" --data-only -Fc \
     -t 'public.lp_*' -t auth.users -t auth.identities > /srv/backups/supabase-data.dump
   ```

   Peringatan "circular foreign-key constraints" itu normal — impor mematikan
   trigger.

4. **Impor**, lalu **bandingkan dengan sumbernya** tabel per tabel:

   ```sh
   scripts/import-supabase-data.sh /srv/backups/supabase-data.dump
   docker compose --env-file .env.production run --rm --no-deps app \
     node scripts/restore-verify.mjs "postgresql://postgres:$POSTGRES_PASSWORD@db:5432/lp" "$SUPABASE_DB_URL" \
     --ignore app_auth.sessions,app_auth.login_failures
   ```

   Harus berakhir `✓ restore cocok dengan sumbernya`. Selain itu: **berhenti,
   lanjut ke "Jalan mundur"**.

5. **Delta file + tulis ulang URL:**

   ```sh
   docker compose --env-file .env.production run --rm --no-deps app \
     node scripts/storage-migrate.mjs export \
     --supabase-url "$SUPABASE_URL" --service-key "$SUPABASE_SERVICE_ROLE_KEY" --root /srv/storage
   docker compose --env-file .env.production run --rm --no-deps app \
     node scripts/storage-migrate.mjs rewrite \
     --database-url "postgresql://postgres:$POSTGRES_PASSWORD@db:5432/lp" \
     --from "$SUPABASE_URL" --to https://admuiux.com            # uji kering: daftar kolom & jumlah
   # …sama, ditambah --apply
   ```

   `--apply` memeriksa sendiri bahwa tidak ada baris yang masih menyebut URL
   lama; kalau ada, seluruhnya dibatalkan.

6. **Nyalakan:**

   ```sh
   docker compose --env-file .env.production up -d
   docker compose --env-file .env.production ps     # db, app healthy; migrate exited 0
   ```

7. **Uji asap di produksi** (browser biasa, lalu jendela privat):
   - [ ] masuk dengan akun lama + sandi lamanya
   - [ ] daftar akun baru → masuk ke `/panel`, banner verifikasi muncul
   - [ ] masuk dengan Google — di `admuiux.com` **dan** di satu storefront lain
   - [ ] ambil produk gratis → muncul di Pembelian → unduh
   - [ ] beli produk berbayar (Duitku sandbox kalau bisa) → callback → unduh
   - [ ] unggah thumbnail produk sebagai penjual; gambar tampil di storefront
   - [ ] chat MbahGPT dengan lampiran
   - [ ] simpan satu setelan situs sebagai Agent
   - [ ] logout → `/panel` mengarah ke `/login`
8. **Backup pertama & cron:**

   ```sh
   scripts/backup.sh
   crontab -e    # 15 3 * * *  cd /srv/landing_pages && scripts/backup.sh >> /var/log/lp-backup.log 2>&1
   ```

   Lalu satu latihan restore dari backup itu di mesin pengembang
   (`scripts/restore-drill.sh db-….dump`) dan catat hasilnya di rencana.

Jendela selesai.

---

## Jalan mundur

Supabase **tidak diubah** oleh langkah B–C (kecuali A3, yang hanya menambah
skema), dan aplikasi lama masih bisa bicara kepadanya:

```sh
git checkout "$(cat /srv/backups/pre-cutover-commit)"
docker compose --env-file .env.production up -d --build --remove-orphans
```

Yang ditulis ke database baru sejak C6 **tidak** ikut kembali. Makin lama sejak
cutover, makin mahal mundurnya — karena itu Fase 6 memberi batas 30 hari.

---

## Gladi (2026-09-22, lokal)

Stack Supabase lokal sebagai "produksi" (dengan skema sengaja tertinggal satu
migration, objek di Storage, dan URL Supabase di database); `docker-compose.yml`
yang sama di bawah nama project lain sebagai "server". Setiap perintah di atas
dijalankan apa adanya, dengan `host.docker.internal` sebagai alamat Supabase.
Hasilnya di bagian Fase 5 rencana.
