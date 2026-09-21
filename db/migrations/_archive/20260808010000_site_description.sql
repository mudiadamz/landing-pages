-- A storefront needs its own meta description, not one derived from its tagline.
--
-- The multi-site change built the description as "{tagline} — {name}.", which for
-- admuiux.com collapsed 157 characters of real search copy into 37. A tagline is
-- a headline; a description is a search snippet. They are different lengths for
-- different jobs, so they get different columns.

alter table public.lp_sites
  add column if not exists description text;

-- Restore the canonical site's original copy, verbatim from app/layout.tsx before
-- the multi-site change, and the original title-case tagline it used.
update public.lp_sites
set
  tagline = 'Produk Digital Siap Pakai',
  description = 'Produk digital siap pakai — template, landing page, dan aset digital. Gratis dan berbayar. By Adam Mudianto, software developer 15+ tahun. Support 1 bulan.'
where is_canonical;
