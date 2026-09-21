-- Update categories: hanya 3 (produk launch, game, app)
delete from public.landing_page_categories;

insert into public.landing_page_categories (id, name, slug, sort_order) values
  (gen_random_uuid(), 'Produk Launch', 'produk-launch', 10),
  (gen_random_uuid(), 'Game', 'game', 20),
  (gen_random_uuid(), 'App', 'app', 30);
