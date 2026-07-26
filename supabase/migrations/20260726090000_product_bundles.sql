-- Product bundles: one product that grants several others when bought.
-- (e.g. selling a 3-part series as a single "complete" purchase.)

alter table lp_landing_pages
  add column if not exists bundle_product_ids uuid[],
  -- "Teks bundle" — optional line describing what the bundle contains, shown
  -- on the checkout/preview above the included items.
  add column if not exists bundle_note text;

-- Which bundle granted this purchase. Null for a normal, directly-bought item.
-- Lets the panel group a bundle's contents under it, and makes the grant
-- traceable if a bundle's contents change later.
alter table lp_purchases
  add column if not exists bundle_parent_id uuid references lp_landing_pages (id) on delete set null;

create index if not exists lp_purchases_bundle_parent_idx on lp_purchases (bundle_parent_id);
