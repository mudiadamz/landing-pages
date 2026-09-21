-- Categories for landing pages (public read, admin manage later if needed)
create table public.landing_page_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order smallint not null default 0
);

alter table public.landing_page_categories enable row level security;

create policy "Public can read categories"
  on public.landing_page_categories for select
  using (true);

-- Add category_id to landing_pages
alter table public.landing_pages
  add column category_id uuid references public.landing_page_categories(id) on delete set null;

create index idx_landing_pages_category_id on public.landing_pages(category_id);

-- Seed: 3 kategori
insert into public.landing_page_categories (id, name, slug, sort_order) values
  (gen_random_uuid(), 'Produk Launch', 'produk-launch', 10),
  (gen_random_uuid(), 'Game', 'game', 20),
  (gen_random_uuid(), 'App', 'app', 30);
