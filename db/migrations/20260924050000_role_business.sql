-- Peran `owner` → `business`.
--
-- "Owner" tidak mengatakan apa-apa di layar ini. Pemilik dari apa? Setiap orang
-- di panel adalah pemilik sesuatu — akunnya, produknya, tokonya. Yang sebenarnya
-- dibedakan kolom ini adalah **orang yang MERUPAKAN business itu** dari orang
-- yang bekerja di dalamnya, dan kata untuk yang pertama adalah "Business".
--
-- Nilainya, bukan cuma labelnya. Label bisa diganti di kamus i18n dalam satu
-- baris; yang diganti di sini adalah nilai di database, karena nilai itulah yang
-- dibaca policy, fungsi SQL, dan kode — dan sebuah sistem yang menyimpan 'owner'
-- sambil menampilkan "Business" adalah sistem yang harus diterjemahkan setiap
-- kali seseorang membaca query.
--
-- Urutan: longgarkan constraint dulu, baru ubah data, baru pasang constraint
-- baru. Terbalik = UPDATE ditolak oleh constraint lama sebelum sempat jalan.

alter table public.lp_business_members
  drop constraint if exists lp_business_members_role_check;

update public.lp_business_members set role = 'business' where role = 'owner';

alter table public.lp_business_members
  add constraint lp_business_members_role_check check (role in ('business', 'staff'));

-- `staff` tetap default: seseorang yang diajak masuk ke sebuah business adalah
-- pekerja di dalamnya sampai ada yang memutuskan sebaliknya. Default yang
-- memberi kendali penuh adalah default yang salah.
alter table public.lp_business_members alter column role set default 'staff';

-- Dua fungsi membaca nilai ini, dan keduanya dipakai policy. Kalau ketinggalan,
-- tidak ada yang error — orang-orang hanya diam-diam berhenti punya izin.
create or replace function public.lp_get_my_profile_role()
  returns text language sql stable security definer set search_path to 'public'
as $$
  select case
    when exists (select 1 from public.lp_profiles p
                  where p.id = auth.uid() and p.is_platform) then 'company'
    -- 'admin' ikut dibaca sekadar sisa: perannya sudah dipensiunkan Fase 5 dan
    -- nol baris memakainya, tapi menghapusnya dari sini tidak menambah apa pun.
    when exists (select 1 from public.lp_business_members m
                  where m.user_id = auth.uid() and m.role in ('business', 'owner', 'admin')) then 'agent'
    else 'customer'
  end;
$$;

create or replace function public.lp_manages_site(p_site_id uuid)
  returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.lp_profiles p
                  where p.id = auth.uid() and p.is_platform)
      or exists (select 1
                   from public.lp_sites s
                   join public.lp_business_members m on m.business_id = s.business_id
                  where s.id = p_site_id and m.user_id = auth.uid()
                    and m.role in ('business', 'owner'));
$$;

comment on column public.lp_business_members.role is
  'business = orang yang MERUPAKAN business ini (mengaturnya). staff = orang yang bekerja di dalamnya. Nilai lama ''owner'' masih dibaca fungsi di atas, tapi tidak ada lagi barisnya.';
