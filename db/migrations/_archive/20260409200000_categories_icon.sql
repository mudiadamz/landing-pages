-- Add icon column to categories for admin-configurable icons
alter table public.landing_page_categories
  add column icon text not null default 'default';

-- Backfill existing categories with matching icons
update public.landing_page_categories set icon = 'sparkle' where slug = 'produk-launch';
update public.landing_page_categories set icon = 'play' where slug = 'game';
update public.landing_page_categories set icon = 'monitor' where slug = 'app';
