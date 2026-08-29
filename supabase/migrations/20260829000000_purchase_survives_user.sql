-- Menghapus user tidak boleh ikut menghapus uangnya.
--
-- lp_purchases.user_id dan lp_plan_orders.user_id keduanya lahir sebagai
-- `not null references auth.users(id) on delete cascade` — wajar waktu tidak ada
-- satu pun cara menghapus user. Begitu panel punya tombol "Hapus user", FK itu
-- jadi lubang: menghapus satu pembeli diam-diam menulis ulang omzet, jumlah
-- penjualan, dan jejak invoice — barisnya hilang tanpa catatan bahwa pernah ada.
--
-- Setelah ini baris penjualan hidup lebih lama daripada pembelinya: user_id
-- boleh NULL dan FK-nya ON DELETE SET NULL. Itu juga arti yang benar dari
-- "hapus akun": identitas orangnya hilang, transaksinya tetap di pembukuan.
--
--   * Aman untuk UNIQUE(user_id, landing_page_id): di Postgres NULL tidak sama
--     dengan NULL, jadi beberapa pembeli terhapus atas produk yang sama tidak
--     bertabrakan.
--   * Aman untuk RLS: `auth.uid() = user_id` tidak pernah cocok dengan NULL,
--     jadi baris yatim itu hanya terlihat oleh service-role — persis yang
--     diinginkan.
--
-- Constraint-nya DICARI berdasarkan kolomnya, dan SEMUA yang cocok di-drop.
-- Dua hal yang membuat versi pertama migration ini salah, keduanya senyap:
--
--   1. Namanya tidak bisa ditebak. Tabel ini pernah bernama `purchases` (lihat
--      rangkaian 2026062100xx), jadi FK-nya masih `purchases_user_id_fkey` di
--      database yang ikut rename dan `lp_purchases_user_id_fkey` di database
--      yang dibuat dari nol.
--   2. lp_purchases punya DUA FK ke auth.users — `user_id` dan `revoked_by`
--      (migration 20260729010000). Mencocokkan "constraint apa pun yang
--      menyebut auth.users" lalu `select ... into` mengambil satu baris
--      sembarang: yang terhapus justru FK `revoked_by`, tanpa error.

do $$
declare
  tbl text;
  con record;
begin
  foreach tbl in array array['lp_purchases', 'lp_plan_orders']
  loop
    execute format('alter table public.%I alter column user_id drop not null', tbl);

    for con in
      select c.conname
        from pg_constraint c
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = c.conkey[1]
       where c.conrelid = format('public.%I', tbl)::regclass
         and c.contype = 'f'
         and c.confrelid = 'auth.users'::regclass
         and array_length(c.conkey, 1) = 1
         and a.attname = 'user_id'
    loop
      execute format('alter table public.%I drop constraint %I', tbl, con.conname);
    end loop;

    execute format(
      'alter table public.%I add constraint %I foreign key (user_id)
         references auth.users (id) on delete set null',
      tbl,
      tbl || '_user_id_fkey'
    );
  end loop;
end $$;

comment on column public.lp_purchases.user_id is
  'Pembeli, atau NULL kalau akunnya sudah dihapus. Baris penjualannya tetap dihitung sebagai omzet — menghapus akun itu keputusan soal data pribadi, bukan refund.';

comment on column public.lp_plan_orders.user_id is
  'Pembeli paket, atau NULL kalau akunnya sudah dihapus. Sama seperti lp_purchases.user_id.';
