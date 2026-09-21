-- Buang planning-poker (pp_) dan texas-poker (tp_) sepenuhnya.
--
-- Keduanya digabung ke database ini pada 2026-06-21 (20260621000000_pp_merge,
-- 20260621000100_tp_merge) supaya tiga app berbagi satu project Supabase.
-- Keduanya sudah pensiun (keputusan Adam, 2026-09-21), dan sisa mereka bukan
-- sekadar tabel menganggur:
--
--   * Trigger `tp_on_auth_user_created` menempel di auth.users — SETIAP
--     pendaftaran di aplikasi ini ikut menjalankan kode texas-poker dan membuat
--     baris tp_profiles yang tidak dipakai siapa pun.
--   * Tabel-tabelnya adalah satu-satunya isi publication supabase_realtime, yaitu
--     satu-satunya alasan layanan Realtime pernah dibutuhkan.
--   * Rencana mencabut Supabase (docs/plans/remove-supabase.md) harus membawa
--     semua ini ke Postgres baru atau membuangnya. Dibuang.
--
-- Tidak ada FK dari tabel lp_ ke tabel pp_/tp_ (diperiksa sebelum migration ini
-- ditulis), jadi cascade di bawah tidak menyentuh data aplikasi ini.
--
-- Migration lama yang membuat objek-objek ini SENGAJA tidak diubah: itu riwayat
-- yang sudah diterapkan di produksi. Mereka diarsipkan saat baseline di Fase 4
-- rencana mencabut Supabase.

-- ---------------------------------------------------------------------------
-- 1. Trigger di auth.users.
--
-- auth.users dimiliki supabase_auth_admin; DROP TRIGGER butuh kepemilikan.
-- Pola yang sama dengan 20260621000200_lp_rename: coba langsung, lalu sebagai
-- pemiliknya. Kalau keduanya gagal pun tidak apa-apa — langkah 2 membuang
-- fungsinya dengan CASCADE, yang ikut membuang trigger yang memanggilnya.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_trigger
              where tgname = 'tp_on_auth_user_created' and tgrelid = 'auth.users'::regclass) then
    begin
      execute 'drop trigger tp_on_auth_user_created on auth.users';
    exception when insufficient_privilege then
      begin
        execute 'set local role supabase_auth_admin';
        execute 'drop trigger tp_on_auth_user_created on auth.users';
        execute 'reset role';
      exception when others then
        execute 'reset role';
        raise notice 'tp_on_auth_user_created: dibuang lewat cascade fungsinya di langkah 2';
      end;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Semua fungsi pp_* / tp_* — dicari, bukan didaftar tangan, supaya yang
--    tertinggal dari migration yang tidak tercatat di sini ikut terbuang.
-- ---------------------------------------------------------------------------
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname ~ '^(pp|tp)_'
  loop
    execute format('drop function if exists %s cascade', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Tabel. Policy, trigger, dan keanggotaan publication ikut hilang bersama
--    tabelnya.
-- ---------------------------------------------------------------------------
drop table if exists
  public.pp_voting_rounds,
  public.pp_players,
  public.pp_rooms,
  public.tp_players,
  public.tp_rooms,
  public.tp_profiles,
  public.tp_app_settings
  cascade;

-- ---------------------------------------------------------------------------
-- 4. Tidak boleh ada sisa. Gagal keras, bukan lolos diam-diam.
-- ---------------------------------------------------------------------------
do $$
declare
  leftovers text;
begin
  select string_agg(what, ', ') into leftovers from (
    select 'tabel ' || c.relname as what
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname ~ '^(pp|tp)_'
    union all
    select 'fungsi ' || p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname ~ '^(pp|tp)_'
    union all
    select 'trigger ' || t.tgname || ' on ' || t.tgrelid::regclass
      from pg_trigger t
     where not t.tgisinternal and t.tgname ~ '^(pp|tp)_'
  ) s;
  if leftovers is not null then
    raise exception 'planning-poker/texas-poker masih tersisa: %', leftovers;
  end if;
end $$;
