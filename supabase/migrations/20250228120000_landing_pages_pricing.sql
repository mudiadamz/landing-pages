-- Add pricing and purchase link to landing pages
alter table public.landing_pages
  add column if not exists price numeric(10,2) default null,
  add column if not exists price_discount numeric(10,2) default null,
  add column if not exists is_free boolean default false,
  add column if not exists purchase_link text default null,
  add column if not exists featured boolean default false;
