-- Access is now role-based (lp_site_settings "role_permissions", edited at
-- /panel/roles), so the per-user permissions array on lp_profiles is unused.
alter table public.lp_profiles
  drop column if exists permissions;
