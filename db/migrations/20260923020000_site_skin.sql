-- Visual style (skin) per storefront — lib/skin.ts.
--
-- The third theming axis next to `template` (what is on the page) and `palette`
-- (what colour it is): what the surfaces are MADE OF — corner radius, depth,
-- blur. It sits on lp_sites beside the other two because it is the same kind of
-- fact about a storefront, chosen in the same screen, read in the same query.
--
-- Default 'glass' reproduces exactly what every site looks like today, so this
-- migration changes nothing until somebody picks otherwise.
--
-- The CHECK is deliberately narrow. An unknown value would fall back to glass in
-- normalizeSkin() and look like nothing happened, which is a worse way to find
-- out about a typo than a failed write.

alter table public.lp_sites
  add column skin text not null default 'glass'
  check (skin in ('glass', 'flat'));

comment on column public.lp_sites.skin is
  'Gaya visual storefront (lib/skin.ts): glass | flat. Radius, bayangan, blur — BUKAN warna (itu palette) dan BUKAN tata letak (itu template). Panel punya setelannya sendiri di lp_site_settings key panel_skin.';

-- No grant needed: lp_sites is GRANT ALL to anon/authenticated already, and a
-- redundant per-column grant would show up on the security surface snapshot as
-- if somebody had decided something.
