-- Configurable label for the "Preview Product" button on the checkout page.
-- Keyword mapped to display text by the reader: "product" (default) → "Preview
-- Product", "buku" → "Preview Buku", "pages" → "Preview Pages". NULL = product.
alter table lp_landing_pages
  add column if not exists preview_label text default null;
