-- Model baru, langkah 2 dari 2: buang bentuk lama.
--
-- Dijalankan SESUDAH kode baru terpasang. Kode baru tidak lagi menyentuh
-- lp_profiles.role, lp_profiles.publisher_*, maupun lp_site_members.role —
-- semuanya sudah pindah (lihat 20260903000000).
--
-- Menjatuhkan kolom itu tidak bisa dibatalkan, jadi urutannya bukan selera:
-- kalau ini jalan lebih dulu, kode lama yang masih terpasang memilih kolom yang
-- sudah tidak ada dan SETIAP query profil gagal — bukan cuma panel.

-- Fungsi yang dipakai 11 RLS policy berhenti menoleh ke kolom lama.
create or replace function public.lp_get_my_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select account_type from public.lp_profiles where id = auth.uid() limit 1;
$$;

comment on function public.lp_get_my_profile_role() is
  'Jenis akun pemanggil: company | agent | customer. Namanya masih "role" karena 11 policy memanggilnya; yang dikembalikan adalah lp_profiles.account_type.';

-- Dua policy membaca kolomnya LANGSUNG, bukan lewat fungsi di atas, jadi
-- kolomnya tidak bisa dijatuhkan sebelum keduanya ditulis ulang. Ditulis tangan
-- karena cuma dua — dan definisinya disalin apa adanya dari pg_policies, hanya
-- `role` yang jadi `account_type`.
drop policy if exists "contacts_select_admin" on public.lp_contacts;
create policy "contacts_select_admin"
  on public.lp_contacts for select to authenticated
  using (
    exists (
      select 1 from public.lp_profiles
       where lp_profiles.id = auth.uid()
         and lp_profiles.account_type = 'company'
    )
  );

drop policy if exists "Admin can read customer profiles" on public.lp_profiles;
create policy "Admin can read customer profiles"
  on public.lp_profiles for select
  using (public.lp_get_my_profile_role() = 'company' and account_type = 'customer');

alter table public.lp_profiles
  drop column if exists role,
  drop column if exists publisher_status,
  drop column if exists publisher_applied_at,
  drop column if exists publisher_reviewed_at,
  drop column if exists publisher_reviewed_by,
  drop column if exists publisher_reject_note,
  drop column if exists publisher_ktp_path,
  drop column if exists publisher_selfie_path,
  drop column if exists publisher_real_name,
  drop column if exists publisher_display_name,
  drop column if exists publisher_address,
  drop column if exists publisher_terms_accepted_at,
  drop column if exists publisher_bank_name,
  drop column if exists publisher_bank_holder,
  drop column if exists publisher_bank_account;

alter table public.lp_site_members drop column if exists role;

comment on table public.lp_site_members is
  'Customer sebuah situs. Sejak model account_type tabel ini TIDAK menyimpan role — Agent ada di lp_site_agents. Yang disimpan di sini: apakah customer ini boleh menjual di situs ini (is_publisher) dan berkas pengajuannya.';
