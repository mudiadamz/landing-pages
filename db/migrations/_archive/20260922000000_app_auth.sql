-- Sesi login milik aplikasi sendiri (docs/plans/remove-supabase.md, fase 3).
--
-- GoTrue memberi JWT + refresh token; aplikasi sekarang memberi token opak
-- (32 byte acak) di cookie httpOnly, dan hanya sha256-nya yang disimpan di sini.
-- Mencuri isi tabel ini tidak memberi satu sesi pun.
--
-- Skema sendiri, bukan `auth`: skema itu masih milik GoTrue sampai fase 4, dan
-- GoTrue memperlakukan isinya sebagai urusannya. Tabel user tetap auth.users —
-- baris, id, dan hash bcrypt yang sama — jadi 20 FK dan trigger
-- lp_handle_new_user tidak berubah.
--
-- Hanya dibaca/ditulis server lewat koneksi DATABASE_URL. Browser tidak punya
-- jalan ke sini: anon/authenticated tidak diberi apa pun, dan RLS menyala tanpa
-- policy sebagai lapis kedua.

create schema if not exists app_auth;
revoke all on schema app_auth from public, anon, authenticated;

create table app_auth.sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Bergeser: dimajukan 30 hari setiap kali sesi dipakai (paling sering sekali
  -- sehari, supaya tidak ada UPDATE di setiap request).
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip text,
  user_agent text
);
-- "Cabut semua sesi user ini" (ban, logout di mana-mana).
create index sessions_user_id_idx on app_auth.sessions (user_id);
alter table app_auth.sessions enable row level security;

-- Percobaan masuk yang GAGAL. GoTrue membatasi per IP; di sini per IP dan per
-- email, supaya menebak sandi satu akun dari banyak alamat juga terhenti.
create table app_auth.login_failures (
  id bigserial primary key,
  ip text,
  email text not null,
  created_at timestamptz not null default now()
);
create index login_failures_ip_idx on app_auth.login_failures (ip, created_at desc);
create index login_failures_email_idx on app_auth.login_failures (email, created_at desc);
alter table app_auth.login_failures enable row level security;

revoke all on all tables in schema app_auth from public, anon, authenticated;
revoke all on all sequences in schema app_auth from public, anon, authenticated;
