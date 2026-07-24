-- EPUB support: a fourth preview source and an EPUB deliverable.
--   preview_type 'epub' → render an uploaded EPUB (preview_url) in the reader,
--     which themes light/dark natively (no separate dark file needed).
--   story_epub_url      → private EPUB the buyer reads after purchase.
alter table public.lp_landing_pages
  add column if not exists story_epub_url text default null;

-- Widen the preview_type check to allow 'epub'.
alter table public.lp_landing_pages
  drop constraint if exists lp_landing_pages_preview_type_check;
alter table public.lp_landing_pages
  add constraint lp_landing_pages_preview_type_check
  check (preview_type in ('html', 'pdf', 'link', 'epub'));
