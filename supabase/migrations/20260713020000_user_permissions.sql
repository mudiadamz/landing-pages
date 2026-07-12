-- Per-feature access delegation. A full admin (role='admin') always has every
-- feature. Other users can be granted specific admin areas via this array of
-- feature keys (stats, users, categories, contacts, inbox, hero, content,
-- custom-js). Only a full admin may edit it (done through the service-role
-- client in the admin API; authenticated users can only update full_name —
-- see 20260713000000_publisher_role.sql).
alter table public.lp_profiles
  add column if not exists permissions text[] not null default '{}';
