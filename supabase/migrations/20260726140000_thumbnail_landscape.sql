-- Optional landscape thumbnail. The listing cards are 16:9, so a portrait
-- cover (common for books) gets badly cropped there. This lets a seller upload
-- a wide version for lists while keeping the portrait one for the product page.
-- Falls back to thumbnail_url when unset.
alter table lp_landing_pages
  add column if not exists thumbnail_landscape_url text;
