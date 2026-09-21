-- Per-product overrides for the preview "buy now" popup card. Both optional;
-- empty falls back to the derived defaults (price line + "Beli sekarang" etc.).
-- The card's ACTION reuses the existing purchase_link/purchase_type columns:
-- purchase_type='external' with a purchase_link links straight there, otherwise
-- the card goes to the internal /checkout flow (the default).
alter table public.lp_landing_pages
  add column if not exists cta_label text default null,
  add column if not exists cta_note text default null;
