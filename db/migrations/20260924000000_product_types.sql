-- Fase 6: katalog untuk segala jenis bisnis — docs/plans/multi-business-saas.md.
--
-- Sampai sekarang "produk" selalu berarti SATU FILE DIGITAL. Bukan lewat sebuah
-- kolom yang bisa dibaca, tapi lewat asumsi yang tersebar: zip_url/story_pdf_url/
-- story_epub_url, preview_type, dan sebuah baris lp_purchases yang artinya
-- "sudah diterima" begitu ia ada. Bisnis yang menjual barang atau jasa tidak
-- punya tempat di model itu — mereka hanya bisa berpura-pura jadi produk digital
-- tanpa file.
--
-- Migration ini menambahkan sumbu yang hilang:
--
--   lp_landing_pages.product_type  'digital' | 'physical' | 'service'
--   lp_purchases.fulfillment_status  siklus pesanan, untuk yang tidak instan
--
-- DUA INVARIAN yang harus dijaga sesudah ini, karena keduanya gagal SENYAP:
--
--  1. fulfillment_status TIDAK menentukan akses. Akses ditentukan oleh adanya
--     baris lp_purchases (dan revoked_at yang kosong) — itu yang dibaca route
--     download, reader EPUB, dan gate bundle. Sebuah pesanan 'pending' tetap
--     milik pembelinya; men-gate download pada status akan mematikan produk
--     digital yang statusnya lupa di-set.
--  2. revoked_at dan fulfillment_status bukan hal yang sama. revoked_at =
--     akses ditarik (keputusan support). fulfillment_status = sejauh mana
--     pesanan dikerjakan. Membatalkan pesanan tidak menarik akses, dan
--     sebaliknya.

-- 1. Sumbu jenis produk -----------------------------------------------------
--
-- Default 'digital' supaya seluruh katalog lama benar tanpa backfill: semuanya
-- memang produk digital. Kolom per-jenis sengaja nullable dan TIDAK dipaksa
-- konsisten oleh CHECK lintas kolom — sebuah produk yang berpindah jenis di
-- panel tidak boleh gagal disimpan hanya karena field jenis lamanya masih
-- terisi. Yang menentukan field mana yang berlaku adalah product_type; sisanya
-- data mati yang tidak dibaca (lib/product-type.ts).

alter table public.lp_landing_pages
  add column if not exists product_type text not null default 'digital',
  -- Fisik: kode barang penjual sendiri, dan stok. stock NULL = tidak dilacak
  -- (arti yang dipilih eksplisit; lihat docs/architecture.md soal kolom yang
  -- ditambah belakangan), 0 = habis.
  add column if not exists sku text,
  add column if not exists stock integer,
  -- Satuan yang tampil di sebelah harga: "pcs", "porsi", "jam", "sesi".
  add column if not exists unit text,
  -- Jasa: berapa lama satu sesi, dan di mana dikerjakan.
  add column if not exists service_duration_minutes integer,
  add column if not exists service_mode text,
  -- Catatan pemenuhan yang tampil ke pembeli sesudah bayar ("dikirim H+1",
  -- "kami hubungi untuk atur jadwal"). Bukan deskripsi produk.
  add column if not exists fulfillment_note text;

alter table public.lp_landing_pages
  add constraint lp_landing_pages_product_type_check
    check (product_type in ('digital', 'physical', 'service')),
  add constraint lp_landing_pages_stock_check
    check (stock is null or stock >= 0),
  add constraint lp_landing_pages_service_duration_check
    check (service_duration_minutes is null or service_duration_minutes > 0),
  add constraint lp_landing_pages_service_mode_check
    check (service_mode is null or service_mode in ('onsite', 'remote', 'both'));

-- `authenticated` hanya punya grant per-KOLOM di tabel ini (lihat baseline),
-- jadi kolom baru tidak ikut terbawa oleh grant tabel dan panel akan gagal
-- menyimpannya dengan "permission denied for table" yang tidak menyebut kolom.
grant insert(product_type), update(product_type) on table public.lp_landing_pages to authenticated;
grant insert(sku), update(sku) on table public.lp_landing_pages to authenticated;
grant insert(stock), update(stock) on table public.lp_landing_pages to authenticated;
grant insert(unit), update(unit) on table public.lp_landing_pages to authenticated;
grant insert(service_duration_minutes), update(service_duration_minutes) on table public.lp_landing_pages to authenticated;
grant insert(service_mode), update(service_mode) on table public.lp_landing_pages to authenticated;
grant insert(fulfillment_note), update(fulfillment_note) on table public.lp_landing_pages to authenticated;

comment on column public.lp_landing_pages.product_type is
  'digital | physical | service. Menentukan field jenis mana yang berlaku dan status pemenuhan awal sebuah pembelian (lib/product-type.ts).';
comment on column public.lp_landing_pages.stock is
  'NULL = stok tidak dilacak, 0 = habis. Hanya berlaku untuk product_type = physical.';

-- 2. Siklus pemenuhan pesanan ------------------------------------------------
--
-- Urutan dua pernyataan di bawah ini yang melakukan backfill: kolom ditambahkan
-- dengan DEFAULT 'done' sehingga setiap baris lama — yang semuanya produk
-- digital dan sudah diterima — benar tanpa UPDATE terpisah; defaultnya baru
-- kemudian diturunkan ke 'pending' untuk baris BARU.
--
-- 'pending' dipilih sebagai default baru dengan sengaja: ketiga jalur insert
-- (gratis, callback Duitku, bundle) menuliskan statusnya secara eksplisit dari
-- product_type, dan kalau suatu saat ada jalur keempat yang lupa, kesalahannya
-- muncul sebagai pesanan yang menunggu diproses — bukan sebagai pesanan fisik
-- yang diam-diam tercatat selesai.

alter table public.lp_purchases
  add column if not exists fulfillment_status text not null default 'done',
  -- Catatan penjual: nomor resi, jadwal yang disepakati, alasan pembatalan.
  add column if not exists fulfillment_note text,
  add column if not exists fulfilled_at timestamptz;

alter table public.lp_purchases
  add constraint lp_purchases_fulfillment_status_check
    check (fulfillment_status in ('pending', 'processing', 'done', 'cancelled'));

update public.lp_purchases set fulfilled_at = purchased_at where fulfilled_at is null;

alter table public.lp_purchases alter column fulfillment_status set default 'pending';

-- Pesanan yang masih butuh dikerjakan — pertanyaan yang ditanyakan /panel/sales
-- setiap kali dibuka, dan satu-satunya alasan index ini ada. Partial, karena
-- 'done' adalah mayoritas baris dan tidak pernah dicari.
create index if not exists lp_purchases_open_idx
  on public.lp_purchases (fulfillment_status)
  where fulfillment_status in ('pending', 'processing');

comment on column public.lp_purchases.fulfillment_status is
  'pending | processing | done | cancelled. Progres pesanan, BUKAN akses — akses ditentukan oleh adanya baris ini dan revoked_at yang kosong.';

-- Grant: lp_purchases punya GRANT ALL di level tabel untuk anon/authenticated,
-- jadi kolom baru ikut terbawa dan tidak perlu grant per-kolom seperti di atas.
