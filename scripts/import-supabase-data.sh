#!/bin/sh
# Cutover, langkah data: isi database baru (dibangun dari db/migrations) dengan
# data dari Supabase. docs/plans/remove-supabase.md, fase 5.
#
#   1. Di Supabase, skema harus SUDAH sama dengan baseline: semua migration di
#      db/migrations/_archive diterapkan (lihat runbook). Data-only dump memakai
#      daftar kolom; kolom yang hilang di salah satu sisi = gagal di sini, bukan
#      diam-diam hilang.
#   2. Dump data saja, hanya yang milik aplikasi:
#        docker run --rm postgres:17-alpine pg_dump "$SUPABASE_DB_URL" \
#          --data-only -Fc -t 'public.lp_*' -t auth.users -t auth.identities > supabase-data.dump
#   3. scripts/import-supabase-data.sh supabase-data.dump
#
# Satu transaksi: gagal di tengah = database tetap kosong, bisa diulang.
# Trigger dimatikan selama impor — kalau tidak, lp_handle_new_user membuat
# profil kedua untuk setiap user yang profilnya juga sedang diimpor.
# Sesi (app_auth) sengaja tidak ikut: semua orang masuk ulang sekali.
set -eu

DUMP="${1:?pakai: scripts/import-supabase-data.sh <supabase-data.dump>}"
PGEXEC="${PGEXEC:-docker compose exec -T db}"
DB="${IMPORT_DB:-lp}"

EXISTING=$($PGEXEC psql -U postgres -d "$DB" -tAc "select (select count(*) from auth.users) + (select count(*) from public.lp_sites)")
if [ "$EXISTING" != "0" ]; then
  echo "Database $DB sudah berisi data ($EXISTING baris di auth.users + lp_sites). Impor hanya ke database kosong." >&2
  exit 1
fi

$PGEXEC pg_restore -U postgres -d "$DB" --data-only --disable-triggers --single-transaction --exit-on-error < "$DUMP"
echo "impor selesai. Bandingkan: node scripts/restore-verify.mjs <URL database ini> <URL Supabase>"
