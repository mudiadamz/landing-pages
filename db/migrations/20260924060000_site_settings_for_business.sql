-- Orang business boleh mengubah setelan situsnya sendiri.
--
-- Sampai sekarang satu-satunya policy UPDATE di `lp_sites` adalah
-- `lp_get_my_profile_role() = 'company'` — Platform saja. Itu konsisten selama
-- gerbang aplikasinya juga Platform saja. Begitu /panel/branding dibuka untuk
-- orang business (dan staff-nya), policy ini jadi setengah yang salah: layarnya
-- terbuka, tombol Simpan-nya menolak, dan errornya tidak menyebut RLS sama
-- sekali. Itu persis jebakan yang ditulis di CLAUDE.md — "policy harus sama
-- dengan gerbang aplikasinya".
--
-- Tapi UPDATE tanpa syarat di tabel ini terlalu banyak. Satu baris `lp_sites`
-- memegang dua jenis kolom yang sangat berbeda:
--
--   PUNYA MEREKA   nama, tagline, deskripsi, template, palette, skin, locale,
--                  logo, icon, kategori — tampilan tokonya sendiri.
--   BUKAN          host, is_canonical, business_id, active, dan seluruh kolom
--                  verifikasi/sertifikat. Itu identitas dan izin: `host` unik
--                  secara global, jadi bisa dipakai merebut domain orang lain,
--                  dan `verified_at` adalah yang menentukan apakah sebuah
--                  sertifikat boleh diterbitkan sama sekali.
--
-- RLS tidak bisa mengungkapkan "kolom ini tidak berubah": USING melihat baris
-- LAMA, WITH CHECK melihat yang BARU, dan tidak ada ekspresi yang melihat
-- keduanya. Trigger bisa. Jadi policy-nya yang membuka pintu, dan trigger yang
-- menjaga kolom mana yang boleh lewat.

-- 1. Siapa yang bekerja di business pemilik situs ini ------------------------
--
-- Peran apa pun, staff ikut. Membedakan `business` dari `staff` adalah urusan
-- lapisan aplikasi (canSellOnCurrentSite vs requireSiteAdmin); di sini
-- pertanyaannya cuma "apakah situs ini ada hubungannya dengan orang ini".

create or replace function public.lp_works_in_site_business(p_site_id uuid)
  returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1
                   from public.lp_sites s
                   join public.lp_business_members m on m.business_id = s.business_id
                  where s.id = p_site_id and m.user_id = auth.uid());
$$;

grant all on function public.lp_works_in_site_business(uuid) to anon, authenticated, service_role;

create policy "Business people update their own site" on public.lp_sites
  for update to authenticated
  using (public.lp_works_in_site_business(id))
  with check (public.lp_works_in_site_business(id));

-- 2. Kolom yang tetap bukan milik mereka -------------------------------------
--
-- Menolak dengan RAISE, bukan diam-diam mengembalikan nilai lama. Perubahan
-- yang ditelan tanpa suara adalah perubahan yang dikira berhasil — dan kalau
-- suatu saat ada layar sah yang ikut mengirim salah satu kolom ini, yang kita
-- butuhkan adalah keluhan yang bisa dilacak, bukan setelan yang tidak pernah
-- tersimpan tanpa ada yang tahu kenapa.
--
-- Hanya berlaku untuk `authenticated`. service_role (importer, aksi domain,
-- panel Platform) melewatinya: ia sudah bypass RLS, dan menambahkan penjaga
-- yang cuma berlaku setengah jalan cuma bikin bingung.

create or replace function public.lp_guard_site_identity() returns trigger
  language plpgsql security definer set search_path to 'public'
as $$
begin
  if current_setting('role', true) = 'service_role' then return new; end if;
  if public.lp_get_my_profile_role() = 'company' then return new; end if;

  if new.host is distinct from old.host then
    raise exception 'host situs hanya bisa diubah Platform' using errcode = '42501';
  end if;
  if new.is_canonical is distinct from old.is_canonical then
    raise exception 'is_canonical hanya bisa diubah Platform' using errcode = '42501';
  end if;
  if new.business_id is distinct from old.business_id then
    raise exception 'pemilik situs hanya bisa diubah Platform' using errcode = '42501';
  end if;
  if new.active is distinct from old.active then
    raise exception 'status aktif situs hanya bisa diubah Platform' using errcode = '42501';
  end if;
  -- Verifikasi & sertifikat: ditulis alur domain lewat service role. Kalau
  -- sebuah business bisa menulis `verified_at` sendiri, seluruh pembuktian
  -- kepemilikan domain jadi hiasan — dan gerbang yang menjaga jatah sertifikat
  -- Let's Encrypt ikut jebol bersamanya.
  if new.verified_at is distinct from old.verified_at
     or new.verification_token is distinct from old.verification_token
     or new.dns_target is distinct from old.dns_target
     or new.cert_ready_at is distinct from old.cert_ready_at then
    raise exception 'status domain hanya ditulis oleh proses verifikasi' using errcode = '42501';
  end if;

  return new;
end;
$$;

grant all on function public.lp_guard_site_identity() to anon, authenticated, service_role;

create trigger lp_sites_identity_guard
  before update on public.lp_sites
  for each row execute function public.lp_guard_site_identity();

comment on function public.lp_works_in_site_business(uuid) is
  'Anggota business pemilik situs ini, peran apa pun. Dipakai policy UPDATE lp_sites; pembedaan business vs staff ada di lapisan aplikasi.';
