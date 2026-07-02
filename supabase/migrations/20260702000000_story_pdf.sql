-- Story PDF for a landing page: full "cerita" the buyer can read from their purchase list.
-- Stored (private) in the same landing-downloads bucket as the ZIP, gated by purchase +
-- served via signed URL (see app/api/story/[slug]).
alter table public.lp_landing_pages
  add column if not exists story_pdf_url text default null;

-- The landing-downloads bucket previously only allowed ZIP mime types; allow PDF too so the
-- service-role upload of the story PDF isn't rejected at the storage layer.
update storage.buckets
  set allowed_mime_types = array['application/zip', 'application/x-zip-compressed', 'application/pdf']
  where id = 'landing-downloads';
