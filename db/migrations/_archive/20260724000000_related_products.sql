-- Manually curated "related products" for a product's preview: an ordered list
-- of other product IDs the seller picks in the product form. Shown at the end of
-- the preview (after the last page of the book/PDF reader). Empty array = none.
alter table lp_landing_pages
  add column if not exists related_product_ids uuid[] not null default '{}';
