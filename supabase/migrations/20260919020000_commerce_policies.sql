-- Policy toko: database menolak hal yang aplikasinya sendiri sudah tolak.
--
-- Browser memegang anon key DAN access token user, jadi siapa pun bisa memanggil
-- PostgREST langsung dengan isi yang tidak pernah dikirim form aplikasi. Untuk
-- tabel-tabel di bawah, policy-nya lebih longgar daripada gerbang di aplikasi —
-- dan gerbang aplikasi tidak berarti apa-apa bagi pemanggil yang melewatinya.
-- Semua terbukti oleh tests/db/rls-commerce.test.ts sebelum migration ini.

-- ---------------------------------------------------------------------------
-- 1. lp_purchases: user hanya boleh "membeli" produk GRATIS untuk dirinya.
--
-- Policy lama cuma `auth.uid() = user_id`. addPurchase (server action "Ambil
-- gratis") juga tidak pernah memeriksa harga — dan server action adalah
-- endpoint POST publik yang argumennya bebas. Dua jalan mendapat produk
-- berbayar gratis: memutar ulang form itu dengan id produk lain, atau satu POST
-- ke /rest/v1/lp_purchases. Pembelian berbayar sungguhan ditulis callback
-- Duitku dengan service role, jadi tidak terpengaruh apa pun di sini.
--
-- Aturan "gratis" di sini HARUS sama dengan isFreeProduct() di
-- lib/product-status.ts: ditandai is_free, atau harga yang dibayar pembeli
-- (diskon positif kalau ada, kalau tidak harga normal) nol/kosong.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can insert own purchases" on public.lp_purchases;
drop policy if exists "Users claim free products for themselves" on public.lp_purchases;
create policy "Users claim free products for themselves"
  on public.lp_purchases for insert
  with check (
    auth.uid() = user_id
    -- Nominal untuk produk gratis = omzet palsu di statistik penjualnya.
    and coalesce(amount, 0) = 0
    and exists (
      select 1 from public.lp_landing_pages p
       where p.id = lp_purchases.landing_page_id
         and (
           p.is_free
           or (coalesce(p.price_discount, 0) <= 0 and coalesce(p.price, 0) <= 0)
         )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. lp_landing_pages: hanya penjual yang boleh membuat produk.
--
-- Policy lama ALL `auth.uid() = user_id` — customer biasa bisa memasukkan
-- produk miliknya sendiri, lengkap dengan purchase_link pilihannya, langsung ke
-- katalog, tanpa lewat gerbang publisher/KYC. Aplikasinya menjaga ini di
-- canSellOnCurrentSite(); databasenya tidak.
--
-- "Penjual" di sini: Company, Agent, atau customer yang publisher di SALAH SATU
-- situs. Gerbang aplikasi tetap lebih ketat (publisher di situs INI) — produk
-- belum punya site_id (lihat docs/plans/hierarchical-users.md), jadi database
-- belum bisa menjawab "di situs mana".
-- ---------------------------------------------------------------------------
create or replace function public.lp_can_sell()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.lp_get_my_profile_role() in ('company', 'agent'), false)
      or exists (
           select 1 from public.lp_site_members m
            where m.user_id = auth.uid() and m.is_publisher
         );
$$;

comment on function public.lp_can_sell() is
  'Pemanggil boleh membuat produk: Company, Agent, atau publisher di salah satu situs. Versi database dari canSellProducts/canSellOnSite — lebih longgar karena produk belum punya site_id.';

drop policy if exists "Users can manage own landing pages" on public.lp_landing_pages;
drop policy if exists "Sellers insert own landing pages" on public.lp_landing_pages;
drop policy if exists "Owners update own landing pages" on public.lp_landing_pages;
drop policy if exists "Owners delete own landing pages" on public.lp_landing_pages;

create policy "Sellers insert own landing pages"
  on public.lp_landing_pages for insert
  with check (auth.uid() = user_id and public.lp_can_sell());

create policy "Owners update own landing pages"
  on public.lp_landing_pages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Owners delete own landing pages"
  on public.lp_landing_pages for delete
  using (auth.uid() = user_id);
-- SELECT tetap lewat "Public can read landing pages" (true). Draft ikut
-- terbaca — celah yang diketahui, dikunci dengan it.fails di tesnya.

-- ---------------------------------------------------------------------------
-- 3. lp_landing_pages: angka bukti sosial hanya ditulis trigger.
--
-- sold_count, like_count, rating dijaga trigger SECURITY DEFINER, view_count
-- oleh RPC lp_increment_view. Grant tabel penuh membuat pemilik produk bisa
-- menulis "Terjual 999" dan rating 5.0 sendiri — lewat UPDATE, atau langsung
-- saat INSERT. Tidak ada jalur aplikasi yang menulis keempatnya lewat client
-- user (diperiksa dengan grep sebelum migration ini).
--
-- Grant-nya DAFTAR kolom. Kolom yang ditambahkan nanti TIDAK otomatis bisa
-- ditulis penjual; tes `setiap kolom sudah diputuskan` merah sampai kolomnya
-- di-grant atau sengaja dimasukkan ke daftar kecualian. Itu disengaja — jebakan
-- avatar_url (lihat 20260919010000) berubah dari gagal-diam-diam jadi tes merah.
-- ---------------------------------------------------------------------------
revoke insert, update on public.lp_landing_pages from authenticated;
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'lp_landing_pages'
     and column_name not in ('id', 'sold_count', 'view_count', 'like_count', 'rating');
  execute format('grant insert (%s), update (%s) on public.lp_landing_pages to authenticated', cols, cols);
end $$;

-- ---------------------------------------------------------------------------
-- 4. lp_reviews: hanya pembeli yang boleh mengulas.
--
-- lib/actions/reviews.ts menolak tanpa pembelian; database tidak. Trigger
-- rating mengubah setiap ulasan jadi skor publik produk, jadi akun mana pun
-- bisa menjatuhkan rating pesaing. Pembelian yang dicabut tidak dihitung —
-- sama dengan yang dilihat pembelinya sendiri lewat RLS lp_purchases.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can insert own reviews" on public.lp_reviews;
drop policy if exists "Buyers insert own reviews" on public.lp_reviews;
create policy "Buyers insert own reviews"
  on public.lp_reviews for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.lp_purchases pu
       where pu.user_id = auth.uid()
         and pu.landing_page_id = lp_reviews.landing_page_id
         and pu.revoked_at is null
    )
  );
