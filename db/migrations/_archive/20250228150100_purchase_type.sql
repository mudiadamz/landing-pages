-- Add purchase_type: 'external' = open purchase_link, 'internal' = go to /checkout/[slug]
alter table public.landing_pages
  add column if not exists purchase_type text default 'internal'
    check (purchase_type in ('external', 'internal'));
