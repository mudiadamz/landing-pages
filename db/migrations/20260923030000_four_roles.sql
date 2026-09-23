-- Empat kedudukan, tidak lebih — permintaan Adam, 2026-09-23.
--
--   Platform · Business owner · Staff · Customer
--
-- Yang dihapus di sini, dan kenapa:
--
--   publisher      `lp_site_members.is_publisher` + seluruh berkas KYC-nya, dan
--                  `lp_site_agents`. Keduanya menjawab pertanyaan yang sama —
--                  "orang ini boleh jualan / mengurus di situs ini" — lewat
--                  tabel masing-masing. Sejak ada pendaftaran Business (Fase 4)
--                  pertanyaan itu punya satu jawaban: daftarkan business-nya,
--                  lalu ajak orangnya sebagai staff.
--   role 'admin'   tingkat pengelola kedua di atas staff; tidak pernah dipakai.
--
-- AMAN dijalankan sekarang, dan itu diperiksa bukan diasumsikan: saat migration
-- ini ditulis database berisi 0 publisher, 0 pengajuan publisher, 0 site agent
-- dan 0 baris role='admin'. Tidak ada yang kehilangan izin jual, dan tidak ada
-- dokumen KYC yang dibuang. Blok DO di bawah menolak jalan kalau ternyata ada —
-- kalau kenyataannya sudah berubah, keputusannya harus diambil ulang, bukan
-- dijalankan diam-diam.

do $$
declare
  n_pub  int;
  n_app  int;
  n_agent int;
begin
  select count(*) into n_pub   from public.lp_site_members where is_publisher;
  select count(*) into n_app   from public.lp_site_members
   where coalesce(publisher_status, 'none') <> 'none';
  select count(*) into n_agent from public.lp_site_agents;

  if n_pub > 0 or n_app > 0 or n_agent > 0 then
    raise exception
      'Menolak: ada % publisher aktif, % pengajuan, % site agent. Migration ini dibuat untuk database yang kosong dari ketiganya — putuskan dulu mereka jadi apa (kemungkinan besar: staff di business pemilik situsnya).',
      n_pub, n_app, n_agent;
  end if;
end $$;

-- 1. Peran business: owner | staff -------------------------------------------
-- Turun, bukan naik. Menggabungkan dua peran jadi satu dengan menebak ke ATAS
-- memberi orang izin yang tidak pernah diputuskan siapa pun.

update public.lp_business_members set role = 'staff' where role = 'admin';

alter table public.lp_business_members drop constraint if exists lp_business_members_role_check;
alter table public.lp_business_members
  add constraint lp_business_members_role_check check (role in ('owner', 'staff'));

comment on column public.lp_business_members.role is
  'owner = mengatur business-nya; staff = sub-akun yang bekerja di dalamnya. Dua tingkat, sengaja — lihat lib/profile-utils.ts.';

-- 2. Fungsi yang menyebut keduanya -------------------------------------------
-- SEBELUM drop, bukan sesudah. Badan fungsi SQL berupa string tidak dilacak
-- sebagai dependency, jadi `drop table` akan BERHASIL dan meninggalkan fungsi
-- yang baru meledak saat dipanggil — kegagalan yang muncul di request pengguna,
-- bukan di migration. lp_manages_site() dipanggil dua policy lp_site_settings;
-- lp_can_sell() dipanggil policy insert lp_landing_pages.

create or replace function public.lp_manages_site(p_site_id uuid) returns boolean
  language sql stable security definer
  set search_path to 'public'
  as $$
  select exists (select 1 from public.lp_profiles p
                  where p.id = auth.uid() and p.is_platform)
      or exists (select 1
                   from public.lp_sites s
                   join public.lp_business_members m on m.business_id = s.business_id
                  where s.id = p_site_id and m.user_id = auth.uid() and m.role = 'owner');
$$;

comment on function public.lp_manages_site(uuid) is
  'Pemanggil boleh mengurus situs ini: Platform, atau owner business pemiliknya. Versi database dari canManageSite (lib/site-membership.ts).';

-- lp_can_sell() ikut kehilangan cabang publisher-nya.
create or replace function public.lp_can_sell() returns boolean
  language sql stable security definer
  set search_path to 'public'
  as $$
  select exists (select 1 from public.lp_profiles p
                  where p.id = auth.uid() and p.is_platform)
      or exists (select 1 from public.lp_business_members m where m.user_id = auth.uid());
$$;

comment on function public.lp_can_sell() is
  'Pemanggil boleh membuat produk: Platform, atau anggota business mana pun (owner ATAU staff — menjual memang pekerjaan staff). Versi database dari canSellProducts.';

-- 3. Publisher & Agent situs --------------------------------------------------
-- Kolom KYC ikut pergi: menyimpan foto KTP dan nomor rekening untuk alur yang
-- sudah tidak ada adalah data pribadi yang disimpan tanpa alasan.

drop table if exists public.lp_site_agents;

alter table public.lp_site_members
  drop column if exists is_publisher,
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
  drop column if exists publisher_bank_name,
  drop column if exists publisher_bank_holder,
  drop column if exists publisher_bank_account,
  drop column if exists publisher_terms_accepted_at;

comment on table public.lp_site_members is
  'Customer sebuah situs. Tidak menyimpan role dan tidak lagi menyimpan izin jual — sejak peran dipangkas jadi empat, "boleh jualan di sini" dijawab keanggotaan business (lp_business_members), bukan baris ini.';
