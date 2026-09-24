-- Penjaga kolom identitas situs hanya berlaku untuk pengguna yang login.
--
-- Versi pertama (20260924060000) memeriksa `current_setting('role')` dan peran
-- profil — dan ikut menghantam semua yang BUKAN permintaan aplikasi: migration,
-- perbaikan manual lewat SQL, dan fixture test yang menyiapkan keadaan sebagai
-- pemilik tabel. Semuanya tidak punya JWT, jadi `lp_get_my_profile_role()`
-- menjawab 'customer' dan penjaga menolak sesuatu yang tidak pernah jadi
-- ancaman.
--
-- `auth.uid() is null` adalah garis yang benar: kalau tidak ada siapa-siapa yang
-- login, ini bukan permintaan dari panel. Itu mencakup service_role (alur
-- domain, importer, aksi Platform — yang memang sudah bypass RLS), runner
-- migration, dan sesi maintenance. Yang tersisa di dalam penjaga persis model
-- ancamannya: seseorang yang login, memakai izin sahnya atas situs sendiri,
-- untuk menulis kolom yang bukan miliknya.

create or replace function public.lp_guard_site_identity() returns trigger
  language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then return new; end if;
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
  if new.verified_at is distinct from old.verified_at
     or new.verification_token is distinct from old.verification_token
     or new.dns_target is distinct from old.dns_target
     or new.cert_ready_at is distinct from old.cert_ready_at then
    raise exception 'status domain hanya ditulis oleh proses verifikasi' using errcode = '42501';
  end if;

  return new;
end;
$$;
