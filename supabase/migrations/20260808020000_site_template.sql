-- Which frontend a storefront renders.
--
-- Deliberately NO check constraint on the value. Templates are code, and the whole
-- point is that adding one for a new niche should be a registry entry plus a
-- component — not a migration. lib/templates/registry.tsx is the authority, and an
-- unknown value falls back to 'default' at render time, so a template that gets
-- renamed or removed degrades to the standard storefront instead of a broken page.

alter table public.lp_sites
  add column if not exists template text not null default 'default';
