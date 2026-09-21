-- Langkah 1 dari 2: database menerima kosakata LAMA dan BARU sekaligus.
--
-- Istilahnya berubah jadi Company → Agent → Customer (lihat glosarium di
-- docs/plans/hierarchical-users.md), dan kali ini nilainya di database ikut:
--   lp_profiles.role      'admin' → 'company'
--   lp_site_members.role  'admin' → 'agent'
--
-- Datanya TIDAK dipindah di sini. Migration ini cuma membuat database menerima
-- keduanya, supaya urutannya aman:
--
--   1. migration ini      → DB menerima lama & baru; kode lama masih jalan
--   2. deploy kode baru   → membaca keduanya, menulis nama baru
--   3. migration kedua    → memindahkan baris & mengetatkan CHECK
--
-- Kebalikannya — memindahkan data lebih dulu — berarti kode lama yang masih
-- terpasang membandingkan 'admin' terhadap baris yang sudah 'company', dan
-- setiap admin terkunci di luar panel sampai deploy selesai.
--
-- Yang membuat ini tidak sepele: 11 RLS policy membandingkan role = 'admin'.
-- Nilai yang di-rename tanpa menyentuh policy itu akan mencabut hak tulis admin
-- atas site settings, kategori, situs, dan plan orders — gagal senyap, dan
-- gagalnya di sisi yang tidak kelihatan dari layar.

-- ---------------------------------------------------------------------------
-- 1. CHECK: terima keduanya
-- ---------------------------------------------------------------------------
alter table public.lp_profiles drop constraint if exists lp_profiles_role_check;
alter table public.lp_profiles
  add constraint lp_profiles_role_check
  check (role in ('admin', 'company', 'customer', 'publisher'));

alter table public.lp_site_members drop constraint if exists lp_site_members_role_check;
alter table public.lp_site_members
  add constraint lp_site_members_role_check
  check (role in ('admin', 'agent', 'publisher', 'customer'));

-- ---------------------------------------------------------------------------
-- 2. Satu tempat yang menormalkan, dipakai semua policy
--
-- Fungsinya yang menjembatani, bukan tiap policy: selama peralihan sebagian
-- baris masih 'admin' dan sebagian sudah 'company', dan tidak ada policy yang
-- perlu tahu itu.
-- ---------------------------------------------------------------------------
create or replace function public.lp_get_my_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when role in ('admin', 'company') then 'company'
           else role
         end
    from public.lp_profiles
   where id = auth.uid()
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Policy: literal 'admin' → 'company'
--
-- Dihasilkan dari definisi policy yang ADA, bukan diketik ulang satu per satu.
-- Sebelas policy yang disalin dengan tangan adalah sebelas kesempatan menulis
-- ulang `using` yang sedikit berbeda, dan RLS yang salah sedikit tidak error —
-- ia hanya menyembunyikan atau membocorkan baris.
-- ---------------------------------------------------------------------------
do $$
declare
  p record;
  q text;
  w text;
  v_cmd text;
  v_roles text;
begin
  for p in
    select schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') || coalesce(with_check, '')) like '%''admin''%'
  loop
    q := replace(coalesce(p.qual, ''), '''admin''', '''company''');
    w := replace(coalesce(p.with_check, ''), '''admin''', '''company''');
    v_cmd := p.cmd;
    v_roles := array_to_string(p.roles, ', ');

    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format(
      'create policy %I on %I.%I as %s for %s to %s %s %s',
      p.policyname,
      p.schemaname,
      p.tablename,
      case when p.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      case v_cmd when 'ALL' then 'all' else lower(v_cmd) end,
      v_roles,
      case when coalesce(p.qual, '') = '' then '' else 'using (' || q || ')' end,
      case when coalesce(p.with_check, '') = '' then '' else 'with check (' || w || ')' end
    );
  end loop;
end $$;

comment on function public.lp_get_my_profile_role() is
  'Role platform pemanggil, dinormalkan: "admin" (nilai lama) dan "company" sama-sama menghasilkan "company". Dipakai policy RLS supaya tidak ada satu pun yang perlu tahu soal peralihan istilah.';
