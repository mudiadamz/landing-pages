-- Manual cache-bust stamp for a product's preview.
--
-- The chapter/cover endpoints set their own long Cache-Control, so the CDN entry
-- belongs to that header and revalidatePath cannot reach it (measured — see
-- lib/epub-version.ts). The only reliable purge is to change the URL, so a purge
-- here means "bump this stamp", which flows into the version token and makes
-- every preview URL for the product a new key.
alter table public.lp_landing_pages
  add column if not exists preview_purged_at timestamptz;
