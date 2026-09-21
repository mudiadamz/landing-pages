-- Which language a storefront renders in.
--
-- Per-site rather than per-visitor: one deployment serves several domains, and
-- the language is a property of the storefront the same way its palette and
-- template are. That also keeps it free of the cache — every per-site reader is
-- already keyed by site id, so the locale rides along in an entry that is
-- already segregated by domain. A per-visitor toggle would have needed locale
-- added to every unstable_cache key instead.
--
-- CHECK rather than an enum: two values today, and adding a third to a CHECK is
-- one ALTER, while adding it to an enum inside a transaction is not.
alter table lp_sites
  add column if not exists locale text not null default 'id'
    check (locale in ('id', 'en'));

comment on column lp_sites.locale is
  'UI language for this storefront. Must match a dictionary in lib/i18n.';
