-- Perbaikan: trigger pendaftaran masih menulis ke kolom yang sudah dihapus.
--
-- `20260903010000_account_type_contract.sql` menghapus `lp_profiles.role`, tapi
-- `lp_handle_new_user()` — yang definisi terakhirnya ada di
-- `20260729000000_email_verified.sql`, jauh sebelum itu — masih melakukan
-- `insert into public.lp_profiles (id, full_name, email, role, email_verified_at)`.
--
-- Akibatnya SETIAP `insert into auth.users` gagal dengan
--   ERROR: column "role" of relation "lp_profiles" does not exist
-- dan karena trigger ini AFTER INSERT di dalam transaksi GoTrue, kegagalannya
-- membatalkan seluruh pendaftaran. Artinya sejak migration contract itu jalan,
-- **tidak ada satu pun akun baru yang bisa dibuat** — signup email maupun login
-- Google pertama kali, keduanya lewat jalur yang sama.
--
-- Terbukti dengan menjalankan insert ke auth.users di database lokal (hasil
-- `supabase db reset`, jadi persis apa yang dihasilkan rangkaian migration ini).
--
-- Kenapa tidak ada yang menangkapnya: tidak ada satu pun tes yang menyentuh
-- database. 131 tes yang ada semuanya pure function, dan semuanya tetap hijau
-- dengan pendaftaran dalam keadaan patah total.

-- ---------------------------------------------------------------------------
-- Perbaikannya: jangan sebut jenis akunnya sama sekali.
--
-- Godaan yang jelas adalah menukar `role` jadi `account_type` dan menaruh
-- 'customer' di situ. Tapi itu persis bentuk yang barusan patah: trigger ini
-- ikut memegang kosakata jenis akun, jadi setiap kali kosakatanya berubah —
-- dan dalam repo ini sudah berubah empat kali — ada satu tempat lagi yang harus
-- diingat, dan diam-diam basi kalau terlupa.
--
-- Kolomnya sudah `not null default 'customer'`. Biarkan default itu yang
-- menjawab. Trigger cuma perlu tahu satu hal: setiap user baru butuh satu baris
-- profil.
-- ---------------------------------------------------------------------------
create or replace function public.lp_handle_new_user()
returns trigger
language plpgsql
security definer
-- SECURITY DEFINER tanpa search_path yang dipatok itu kelas kerentanan sendiri:
-- pemanggil bisa menyisipkan schema di depan `public` dan membajak nama tabel
-- yang diresolve di dalam fungsi ini, yang jalan dengan hak pemilik tabel.
set search_path = public
as $$
begin
  insert into public.lp_profiles (id, full_name, email, email_verified_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    -- Daftar lewat Google = alamatnya sudah dibuktikan oleh Google. Daftar lewat
    -- email = belum dibuktikan apa pun; `lib/email-verify.ts` yang mengisinya
    -- nanti lewat email Resend sendiri.
    case
      when coalesce(new.raw_app_meta_data->>'provider', 'email') = 'email' then null
      else now()
    end
  );
  return new;
end;
$$;

comment on function public.lp_handle_new_user() is
  'Membuat baris lp_profiles untuk setiap user baru di auth.users. Sengaja TIDAK menyebut account_type — kolomnya punya default, dan menyebutnya di sini berarti kosakata jenis akun tersimpan di dua tempat (itu yang membuat fungsi ini patah waktu kolom role dihapus).';
