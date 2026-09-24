-- Fase 6b: alamat kirim + stok yang berkurang sendiri.
--
-- Fase 6 memberi katalog ini sumbu `product_type` dan siklus pesanan, tapi
-- sengaja berhenti sebelum dua hal yang membuat barang fisik benar-benar bisa
-- dijual: penjual tidak tahu ke mana mengirim, dan stok cuma angka yang ditulis
-- tangan. Keduanya ditambahkan di sini.
--
-- TIGA keputusan yang menentukan bentuk file ini:
--
--  1. **Alamat disimpan di PESANAN, bukan di profil pembeli.** Sebuah alamat di
--     `lp_profiles` akan terbaca oleh setiap business tempat orang itu pernah
--     belanja — alamat rumah yang diberikan ke toko A bocor ke toko B. Di
--     `lp_purchases` ia hanya ikut pesanan yang memang milik penjual itu. Efek
--     sampingnya benar juga: alamat adalah SNAPSHOT saat memesan, jadi pembeli
--     yang pindah rumah tidak menulis ulang riwayat pengirimannya.
--
--  2. **Ada tabel singgah (`lp_pending_shipping`), karena baris pembelian untuk
--     produk BERBAYAR dibuat oleh callback Duitku** — server-to-server, tanpa
--     form. Alamatnya harus menunggu di suatu tempat antara "klik bayar" dan
--     "callback datang". Yang jelas BUKAN di Duitku: alamat rumah pembeli tidak
--     dikirim ke pihak ketiga hanya supaya bisa dikembalikan lagi.
--
--  3. **Stok berkurang lewat TRIGGER, bukan di kode.** Ada tiga jalur insert
--     pembelian (gratis, callback, bundle) dan tidak ada satu pun tempat di
--     TypeScript yang dilewati ketiganya. Trigger juga atomik dengan insert-nya,
--     jadi dua pembeli yang menekan tombol bersamaan tidak bisa mengurangi stok
--     yang sama dua kali. Presedennya `sold_count`, yang sudah begitu sejak awal.

-- 1. Alamat kirim, sebagai snapshot di pesanan --------------------------------
--
-- NULL berarti "pesanan ini tidak butuh alamat" (produk digital/jasa) ATAU
-- "dibuat sebelum kolom ini ada". Keduanya tidak bisa dibedakan dan memang tidak
-- perlu: yang menentukan apakah alamat WAJIB adalah product_type, bukan isi
-- kolom ini.

alter table public.lp_purchases
  add column if not exists shipping_name text,
  add column if not exists shipping_phone text,
  add column if not exists shipping_address text,
  add column if not exists shipping_city text,
  add column if not exists shipping_province text,
  add column if not exists shipping_postal_code text,
  add column if not exists shipping_note text;

comment on column public.lp_purchases.shipping_name is
  'Snapshot alamat kirim saat memesan. NULL = pesanan ini tidak butuh alamat (bukan barang fisik), atau dibuat sebelum kolom ini ada.';

-- 2. Tabel singgah: alamat yang menunggu pembayaran selesai -------------------
--
-- Satu baris per (pembeli, produk) — kalau dia mengulang checkout produk yang
-- sama, alamat terakhir yang menang, bukan dua baris yang harus dipilih salah
-- satunya. Baris dihapus oleh callback begitu alamatnya disalin ke pesanan.
--
-- Yang batal bayar meninggalkan baris menggantung. Itu bukan kebocoran (RLS
-- mengikat ke pemiliknya) tapi tetap sampah, jadi create-invoice menyapu milik
-- pemanggilnya sendiri yang lebih tua dari 30 hari. Sengaja bukan cron: sapuan
-- yang ikut jalur yang sudah ada tidak bisa mati diam-diam.

create table public.lp_pending_shipping (
  user_id uuid not null references auth.users(id) on delete cascade,
  landing_page_id uuid not null references public.lp_landing_pages(id) on delete cascade,
  shipping_name text not null,
  shipping_phone text not null,
  shipping_address text not null,
  shipping_city text not null,
  shipping_province text,
  shipping_postal_code text not null,
  shipping_note text,
  created_at timestamptz not null default now(),
  primary key (user_id, landing_page_id)
);
alter table public.lp_pending_shipping enable row level security;
grant all on table public.lp_pending_shipping to anon, authenticated, service_role;

-- Pembeli mengurus barisnya sendiri; tidak ada yang bisa membaca alamat orang
-- lain lewat jalur ini. Penjual TIDAK diberi akses ke tabel ini sama sekali —
-- alamat baru jadi urusannya setelah pembayaran berhasil, yaitu di pesanan.
create policy "Users manage their own pending shipping" on public.lp_pending_shipping
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role manages lp_pending_shipping" on public.lp_pending_shipping
  for all to service_role using (true) with check (true);

comment on table public.lp_pending_shipping is
  'Alamat kirim yang menunggu callback Duitku. Dihapus begitu disalin ke lp_purchases.';

-- 3. Stok yang berkurang & kembali -------------------------------------------
--
-- `stock_held` mencatat apakah pesanan INI benar-benar mengambil satu unit.
-- Tanpa itu, membatalkan pesanan yang dulu masuk saat stok sudah 0 (kejadian
-- balapan antar-pembeli) akan MENCIPTAKAN stok yang tidak pernah ada.

alter table public.lp_purchases
  add column if not exists stock_held boolean not null default false;

comment on column public.lp_purchases.stock_held is
  'Pesanan ini sedang memegang satu unit stok. Dipasang trigger saat insert, dilepas saat dibatalkan/dihapus.';

create function public.lp_sync_product_stock() returns trigger
  language plpgsql security definer
  set search_path to 'public'
  as $$
begin
  if tg_op = 'INSERT' then
    -- `stock > 0` menjaga CHECK (stock >= 0) tanpa MENGGAGALKAN insert-nya.
    -- Itu disengaja dan penting: di jalur callback uangnya sudah diterima, dan
    -- menolak baris pembelian di situ berarti pembeli membayar lalu tidak
    -- mendapat apa pun. Kelebihan jual muncul sebagai pesanan yang harus
    -- diselesaikan penjual — untuk itulah antrian pesanan ada — bukan sebagai
    -- pembayaran yang hilang. Gerbang "stok habis" ada di checkout, SEBELUM
    -- uangnya berpindah.
    update public.lp_landing_pages
       set stock = stock - 1
     where id = new.landing_page_id
       and product_type = 'physical'
       and stock is not null
       and stock > 0;
    new.stock_held := found;
    return new;

  elsif tg_op = 'UPDATE' then
    -- Hanya pada PERPINDAHAN ke 'cancelled'. Status itu terminal di
    -- lib/product-type.ts, jadi satu pesanan tidak bisa melepas stok dua kali —
    -- dan `old.stock_held` menutup sisanya kalau aturan itu pernah dilonggarkan.
    if new.fulfillment_status = 'cancelled'
       and old.fulfillment_status is distinct from 'cancelled'
       and old.stock_held then
      update public.lp_landing_pages
         set stock = stock + 1
       where id = new.landing_page_id
         and stock is not null;
      new.stock_held := false;
    end if;
    return new;

  else -- DELETE
    if old.stock_held then
      update public.lp_landing_pages
         set stock = stock + 1
       where id = old.landing_page_id
         and stock is not null;
    end if;
    return old;
  end if;
end;
$$;

grant all on function public.lp_sync_product_stock() to anon, authenticated, service_role;

-- BEFORE, bukan AFTER: fungsi ini menulis `new.stock_held` pada barisnya
-- sendiri, dan baris yang sudah tersimpan hanya bisa diubah dengan UPDATE kedua
-- yang akan memicu trigger ini lagi.
create trigger lp_purchases_stock_sync
  before insert or update or delete on public.lp_purchases
  for each row execute function public.lp_sync_product_stock();
