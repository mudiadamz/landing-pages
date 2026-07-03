-- Show/hide toggle for a product. Hidden pages (published = false) are excluded
-- from public listings (homepage) and 404 for non-owners on /lp/[slug] and
-- /checkout/[slug]. The owner (admin) can still open their own hidden page to
-- preview it. Existing purchases/downloads are unaffected (gated by lp_purchases).
alter table public.lp_landing_pages
  add column if not exists published boolean not null default true;

create index if not exists lp_landing_pages_published_idx
  on public.lp_landing_pages (published);
