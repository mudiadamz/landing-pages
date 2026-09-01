-- Model baru, langkah 1 dari 2: tambah bentuk baru, isi datanya, JANGAN hapus
-- apa pun dulu.
--
-- Bentuk lama                        Bentuk baru
--   lp_profiles.role                   lp_profiles.account_type  company|agent|customer
--     company|agent|customer
--     (+ publisher — dihapus)
--   lp_profiles.publisher_*          → lp_site_members.publisher_*   (per situs)
--   lp_site_members.role               lp_site_members.is_publisher  (flag)
--     agent|publisher|customer          — keanggotaan HANYA berisi customer
--   (agent nebeng di keanggotaan)    → lp_site_agents(site_id, user_id)
--
-- Tiga perubahan arti, bukan sekadar pindah kolom:
--
--   1. "Publisher" berhenti jadi jenis akun dan jadi FLAG pada seorang customer
--      di satu situs. Satu orang bisa publisher di situs A dan pembeli biasa di
--      situs B, dan itu memang yang diminta.
--   2. Berkas KYC ikut per-situs. Konsekuensinya disengaja: tiap storefront
--      memverifikasi penjualnya sendiri, dan foto KTP orang yang sama tersimpan
--      sekali per situs tempat dia mengajukan.
--   3. Agent tidak lagi menumpang di tabel keanggotaan. Tabel sendiri, supaya
--      satu situs tetap bisa punya lebih dari satu Agent — kemampuan yang ada
--      hari ini dan akan hilang kalau Agent-nya jadi satu kolom di lp_sites.
--
-- Kolom lama (`role`, `publisher_*` di lp_profiles) SENGAJA masih ada di sini.
-- Kode yang sedang terpasang membacanya; menghapusnya sekarang berarti panel
-- mati sampai deploy berikutnya selesai. Migration 20260903010000 yang
-- menghapusnya, sesudah kode baru live.

-- ---------------------------------------------------------------------------
-- 1. lp_profiles.account_type
-- ---------------------------------------------------------------------------
alter table public.lp_profiles
  add column if not exists account_type text not null default 'customer';

-- publisher BUKAN jenis akun lagi: seorang publisher pada dasarnya customer,
-- dan "boleh menjual" jadi flag per situs di bawah.
update public.lp_profiles
   set account_type = case
         when role in ('company', 'admin') then 'company'
         when role = 'agent'               then 'agent'
         else 'customer'
       end;

alter table public.lp_profiles drop constraint if exists lp_profiles_account_type_check;
alter table public.lp_profiles
  add constraint lp_profiles_account_type_check
  check (account_type in ('company', 'agent', 'customer'));

create index if not exists lp_profiles_account_type_idx
  on public.lp_profiles (account_type);

comment on column public.lp_profiles.account_type is
  'Jenis akun: company | agent | customer. Menggantikan lp_profiles.role. "Publisher" bukan jenis akun — itu flag pada keanggotaan situs (lp_site_members.is_publisher).';

-- ---------------------------------------------------------------------------
-- 2. Fungsi yang dipakai 11 RLS policy
--
-- Membaca account_type kalau ada isinya, jatuh ke role kalau tidak. Selama
-- peralihan kedua kolom hidup berdampingan, dan tidak ada satu policy pun yang
-- perlu tahu itu — sama seperti waktu 'admin' berubah jadi 'company'.
-- ---------------------------------------------------------------------------
create or replace function public.lp_get_my_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when coalesce(account_type, '') <> '' then account_type
           when role in ('admin', 'company')     then 'company'
           else coalesce(role, 'customer')
         end
    from public.lp_profiles
   where id = auth.uid()
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. lp_site_agents — Agent mana mengelola situs mana
-- ---------------------------------------------------------------------------
create table if not exists public.lp_site_agents (
  site_id    uuid not null references public.lp_sites (id) on delete cascade,
  user_id    uuid not null references auth.users (id)      on delete cascade,
  created_at timestamptz not null default now(),
  invited_by uuid references auth.users (id) on delete set null,
  primary key (site_id, user_id)
);

create index if not exists lp_site_agents_user_idx
  on public.lp_site_agents (user_id);

comment on table public.lp_site_agents is
  'Agent mana mengelola situs mana. Terpisah dari lp_site_members, yang sejak model ini hanya berisi customer. Satu situs boleh punya beberapa Agent.';

alter table public.lp_site_agents enable row level security;

drop policy if exists "Agents read own site links" on public.lp_site_agents;
create policy "Agents read own site links"
  on public.lp_site_agents for select
  using (auth.uid() = user_id);

-- Siapa pun yang selama ini tercatat sebagai agent di keanggotaan, pindah ke sini.
insert into public.lp_site_agents (site_id, user_id)
select m.site_id, m.user_id
  from public.lp_site_members m
 where m.role in ('agent', 'admin')
on conflict (site_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. lp_site_members: flag publisher + berkas pengajuannya
-- ---------------------------------------------------------------------------
alter table public.lp_site_members
  add column if not exists is_publisher                boolean not null default false,
  add column if not exists publisher_status            text not null default 'none',
  add column if not exists publisher_applied_at        timestamptz,
  add column if not exists publisher_reviewed_at       timestamptz,
  add column if not exists publisher_reviewed_by       uuid references auth.users (id) on delete set null,
  add column if not exists publisher_reject_note       text,
  add column if not exists publisher_ktp_path          text,
  add column if not exists publisher_selfie_path       text,
  add column if not exists publisher_real_name         text,
  add column if not exists publisher_display_name      text,
  add column if not exists publisher_address           text,
  add column if not exists publisher_terms_accepted_at timestamptz,
  add column if not exists publisher_bank_name         text,
  add column if not exists publisher_bank_holder       text,
  add column if not exists publisher_bank_account      text;

alter table public.lp_site_members drop constraint if exists lp_site_members_pub_status_check;
alter table public.lp_site_members
  add constraint lp_site_members_pub_status_check
  check (publisher_status in ('none', 'pending', 'approved', 'rejected'));

/*
 * Berkas pengajuan disalin dari profil ke SETIAP situs yang orang itu ikuti.
 *
 * Menyalin, bukan memindahkan sekali: sesudah model ini, pengajuan itu milik
 * pasangan (orang, situs). Orang yang sudah disetujui sebagai publisher hari ini
 * tidak boleh tiba-tiba kehilangan status jualannya di situs mana pun hanya
 * karena bentuk tabelnya berubah — jadi status lamanya berlaku di semua situs
 * yang sudah dia ikuti, dan pengajuan berikutnya berjalan per situs.
 */
update public.lp_site_members m
   set is_publisher                = (p.publisher_status = 'approved' or m.role = 'publisher'),
       publisher_status            = case
                                       when m.role = 'publisher' and p.publisher_status = 'none'
                                         then 'approved'
                                       else p.publisher_status
                                     end,
       publisher_applied_at        = p.publisher_applied_at,
       publisher_reviewed_at       = p.publisher_reviewed_at,
       publisher_reviewed_by       = p.publisher_reviewed_by,
       publisher_reject_note       = p.publisher_reject_note,
       publisher_ktp_path          = p.publisher_ktp_path,
       publisher_selfie_path       = p.publisher_selfie_path,
       publisher_real_name         = p.publisher_real_name,
       publisher_display_name      = p.publisher_display_name,
       publisher_address           = p.publisher_address,
       publisher_terms_accepted_at = p.publisher_terms_accepted_at,
       publisher_bank_name         = p.publisher_bank_name,
       publisher_bank_holder       = p.publisher_bank_holder,
       publisher_bank_account      = p.publisher_bank_account
  from public.lp_profiles p
 where p.id = m.user_id;

comment on column public.lp_site_members.is_publisher is
  'Customer ini boleh menjual DI SITUS INI. Publisher bukan jenis akun — ia customer dengan izin jual, dan izinnya per situs.';

-- Sesudah model ini, keanggotaan hanya berisi customer. Kolom role belum
-- dihapus (kode lama masih membacanya), tapi CHECK-nya dilonggarkan supaya
-- tidak menghalangi apa pun sampai kolomnya benar-benar hilang.
alter table public.lp_site_members drop constraint if exists lp_site_members_role_check;
