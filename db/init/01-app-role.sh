#!/bin/sh
# Dijalankan image postgres SEKALI, saat volume datanya masih kosong
# (/docker-entrypoint-initdb.d). Membuat role login `app` yang dipakai aplikasi.
#
# Role-nya sendiri (dan anon/authenticated/service_role) juga dibuat baseline
# migration kalau belum ada — di sini hanya bagian yang tidak boleh masuk git:
# password-nya. Aplikasi tersambung sebagai `app`; migration dan backup sebagai
# pemilik (POSTGRES_USER).
set -eu

if [ -z "${APP_DB_PASSWORD:-}" ]; then
  echo "APP_DB_PASSWORD kosong — role app tidak bisa login." >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 -v pw="$APP_DB_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
select 'create role app' where not exists (select 1 from pg_roles where rolname = 'app') \gexec
alter role app login password :'pw';
SQL
