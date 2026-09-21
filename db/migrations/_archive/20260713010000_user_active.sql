-- Active / non-active users. Admins can deactivate a user from the Users panel.
-- is_active is the display source-of-truth in lp_profiles; enforcement is done at
-- the auth level (the admin action also bans/unbans via the service-role auth API,
-- so a deactivated user's session stops working). Authenticated users cannot
-- change this column themselves — UPDATE is granted only on full_name
-- (see 20260713000000_publisher_role.sql).
alter table public.lp_profiles
  add column if not exists is_active boolean not null default true;

create index if not exists lp_profiles_is_active_idx
  on public.lp_profiles (is_active);
