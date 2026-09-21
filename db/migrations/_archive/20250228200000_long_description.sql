-- Add long description to landing_pages (for product detail / checkout)
alter table public.landing_pages
  add column if not exists long_description text default null;
