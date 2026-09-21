-- Fase 1 dari docs/plans/hierarchical-users.md: keanggotaan per-situs.
--
-- Bentuknya dipaksa oleh satu kenyataan: auth.users punya users_email_partial_key,
-- jadi satu email = satu akun untuk seluruh project Supabase. "User milik satu
-- situs" dalam arti terpisah total mustahil tanpa project Supabase per domain.
-- Yang bisa: akun tetap global, dan KEANGGOTAAN-nya yang per-situs — satu orang
-- boleh jadi admin di situs A dan pembeli di situs B, sementara pembeliannya
-- tetap menyatu di "Pembelian saya".
--
-- Fase ini sengaja tidak mengubah perilaku apa pun. Tidak ada kode yang membaca
-- tabel ini setelah migration ini jalan. Backfill yang salah harus ketahuan
-- sebagai baris yang salah di database, bukan sebagai admin yang terkunci di
-- luar panel dua fase kemudian.

create table if not exists public.lp_site_members (
  site_id    uuid not null references public.lp_sites (id) on delete cascade,
  user_id    uuid not null references auth.users (id)      on delete cascade,
  /* Role DI SITUS INI. Beda dari lp_profiles.role, yang mulai fase 7 hanya
     berarti tingkat platform. */
  role       text not null default 'customer'
             check (role in ('admin', 'publisher', 'customer')),
  created_at timestamptz not null default now(),
  invited_by uuid references auth.users (id) on delete set null,
  primary key (site_id, user_id)
);

comment on table public.lp_site_members is
  'Keanggotaan per-situs. Akun tetap global (auth.users); tabel ini yang menentukan seseorang boleh apa di sebuah storefront. Lihat docs/plans/hierarchical-users.md.';

/* Kedua FK cascade — beda dari lp_purchases.user_id yang sengaja SET NULL
   (migration 20260829000000). Keanggotaan itu relasi, bukan catatan keuangan:
   situsnya hilang atau akunnya hilang, relasinya memang tidak punya arti lagi. */

-- "Situs apa saja yang boleh dibuka orang ini" — dipakai switcher panel di fase 3.
create index if not exists lp_site_members_user_idx
  on public.lp_site_members (user_id);

alter table public.lp_site_members enable row level security;

/* Baca: hanya barisnya sendiri. Layar admin membacanya lewat service-role, dan
   setiap pemakaian service-role wajib punya gate otorisasi sendiri — tidak ada
   policy tulis di sini, jadi RLS tidak bisa disalahartikan sebagai penjaganya. */
drop policy if exists "Members read own memberships" on public.lp_site_members;
create policy "Members read own memberships"
  on public.lp_site_members for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Backfill
--
-- Urutannya penting. Tiap insert memakai ON CONFLICT DO NOTHING, jadi role yang
-- paling berwenang harus masuk lebih dulu: seorang admin yang juga pernah
-- membeli sesuatu harus tetap tercatat 'admin', bukan tertimpa 'customer'.
--
-- Yang diabadikan di sini adalah kenyataan HARI INI, bukan kenyataan yang kita
-- inginkan. Hari ini setiap admin bisa membuka setiap situs, jadi backfill-nya
-- pun begitu — supaya fase 3 (cakupan panel ikut keanggotaan) tidak mengubah
-- apa pun bagi mereka.
-- ---------------------------------------------------------------------------

-- 1. Admin → semua situs.
insert into public.lp_site_members (site_id, user_id, role)
select s.id, p.id, 'admin'
  from public.lp_sites s
 cross join public.lp_profiles p
 where lower(coalesce(p.role, '')) = 'admin'
on conflict (site_id, user_id) do nothing;

-- 2. Publisher → situs kanonik. Produk belum punya pemilik situs
--    (lp_landing_pages tidak punya site_id — lihat "keputusan yang masih
--    terbuka" di dokumen rencana), jadi kanonik adalah satu-satunya jawaban
--    yang tidak mengarang atribusi.
insert into public.lp_site_members (site_id, user_id, role)
select s.id, p.id, 'publisher'
  from public.lp_sites s
 cross join public.lp_profiles p
 where s.is_canonical
   and lower(coalesce(p.role, '')) = 'publisher'
on conflict (site_id, user_id) do nothing;

-- 3. Pembeli → tiap situs tempat dia benar-benar membeli.
--    site_id NULL berarti pembelian dari masa ketika deployment ini hanya
--    melayani satu domain; jatuhnya ke kanonik, aturan yang sama persis dengan
--    lib/site-scope.ts. user_id NULL berarti akunnya sudah dihapus (migration
--    20260829000000) — tidak ada yang bisa dijadikan anggota.
insert into public.lp_site_members (site_id, user_id, role)
select distinct
       coalesce(pur.site_id, (select id from public.lp_sites where is_canonical limit 1)),
       pur.user_id,
       'customer'
  from public.lp_purchases pur
 where pur.user_id is not null
   and coalesce(pur.site_id, (select id from public.lp_sites where is_canonical limit 1)) is not null
on conflict (site_id, user_id) do nothing;

-- 4. Sisanya → kanonik.
--    Akun yang mendaftar tapi belum pernah membeli. Tanpa baris ini mereka tidak
--    jadi anggota situs mana pun, dan di fase 4 akan HILANG dari daftar user
--    setiap situs — orang yang menghilang karena backfill adalah persis jenis
--    kegagalan senyap yang fase ini ada untuk mencegahnya.
--    Situs mana: kanonik, dengan alasan yang sama seperti nomor 3.
insert into public.lp_site_members (site_id, user_id, role)
select s.id, p.id, 'customer'
  from public.lp_profiles p
 cross join public.lp_sites s
 where s.is_canonical
   and not exists (
     select 1 from public.lp_site_members m where m.user_id = p.id
   )
on conflict (site_id, user_id) do nothing;
