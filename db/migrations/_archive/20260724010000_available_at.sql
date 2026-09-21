-- Scheduled release ("upcoming") for a product. When set and still in the
-- future, the product is published but locked: non-owners see only a countdown
-- on the preview + checkout pages and cannot read or buy until this instant
-- passes. NULL = available immediately (normal behaviour).
alter table lp_landing_pages
  add column if not exists available_at timestamptz default null;
