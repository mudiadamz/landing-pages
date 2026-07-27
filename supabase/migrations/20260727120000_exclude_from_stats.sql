-- Mark a user's traffic as internal so it never reaches analytics. Mostly the
-- team's own accounts: constant testing during a live campaign otherwise shows
-- up as real visitors and skews bounce/read rates.
--
-- Only works for signed-in users — an anonymous visitor can't be identified, so
-- exclusion can't be applied to them.
alter table lp_profiles
  add column if not exists exclude_from_stats boolean not null default false;
