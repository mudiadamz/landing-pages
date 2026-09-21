#!/bin/sh
# Latihan restore: backup → database kosong → dibandingkan dengan sumbernya.
#
#   scripts/restore-drill.sh <db-….dump> [SOURCE_DATABASE_URL]
#
# Dijalankan di mesin pengembang, di atas container compose.dev.yml (bukan di
# server produksi): salin satu backup ke sini, lalu jalankan. Tanpa
# SOURCE_DATABASE_URL, jumlah baris hanya dicetak; dengan itu, setiap tabel
# dibandingkan dengan sumbernya dan satu selisih pun = gagal.
#
# Role (anon/authenticated/service_role/app) bukan bagian pg_dump — itu milik
# server, bukan database — jadi dibuat dulu di sini, sama seperti di server
# baru. Kalau langkah itu terlupa, pg_restore gagal di grant pertama; itu salah
# satu hal yang dicari latihan ini.
set -eu

DUMP="${1:?pakai: scripts/restore-drill.sh <db-….dump> [SOURCE_DATABASE_URL]}"
SOURCE="${2:-}"
PGEXEC="${PGEXEC:-docker compose -f compose.dev.yml exec -T db}"
TARGET="${RESTORE_URL:-postgresql://postgres:postgres@127.0.0.1:54329/lp_restore_drill}"

$PGEXEC psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
drop database if exists lp_restore_drill with (force);
create database lp_restore_drill;
select 'create role anon nologin noinherit' where not exists (select 1 from pg_roles where rolname = 'anon') \gexec
select 'create role authenticated nologin noinherit' where not exists (select 1 from pg_roles where rolname = 'authenticated') \gexec
select 'create role service_role nologin noinherit bypassrls' where not exists (select 1 from pg_roles where rolname = 'service_role') \gexec
select 'create role app nologin' where not exists (select 1 from pg_roles where rolname = 'app') \gexec
SQL

START=$(date +%s)
$PGEXEC pg_restore -U postgres -d lp_restore_drill --exit-on-error < "$DUMP"
echo "pg_restore selesai dalam $(( $(date +%s) - START )) detik"

node scripts/restore-verify.mjs "$TARGET" "$SOURCE"
