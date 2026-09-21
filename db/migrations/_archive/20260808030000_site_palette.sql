-- Colour palette per storefront.
--
-- Stores a PRESET KEY, not hex values. The presets in lib/palette.ts already had
-- their contrast measured against the fixed backgrounds; letting each domain carry
-- six raw colours instead would mean six more chances to ship an unreadable site,
-- with no measurement behind them.
--
-- Free text like `template`, validated in code against PALETTE_PRESETS, so adding a
-- palette is a code change and an unknown key falls back to the default rather than
-- rendering a site with no primary colour.

alter table public.lp_sites
  add column if not exists palette text not null default 'forest';
