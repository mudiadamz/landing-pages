-- =====================================================================
-- Publisher role: a customer can apply to become a publisher; an admin
-- confirms. Approved publishers can create & sell their own products
-- (products they own via lp_landing_pages.user_id — RLS already scopes
-- "manage own landing pages" to auth.uid() = user_id).
--
-- Role model (per product decision): a distinct third role.
--   role: admin | customer | publisher
-- Application lifecycle is tracked separately so we know who is pending:
--   publisher_status: none | pending | approved | rejected
--   - customer applies        -> status = pending (role stays customer)
--   - admin approves           -> role = publisher, status = approved
--   - admin rejects            -> role stays customer, status = rejected
-- =====================================================================

-- 1. Allow 'publisher' in the role check constraint. The original inline
--    constraint keeps its creation-time name after the table RENAME, so drop
--    any existing check constraint that guards `role`, then re-add.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.lp_profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
      and pg_get_constraintdef(oid) not ilike '%publisher_status%'
  loop
    execute format('alter table public.lp_profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.lp_profiles
  add constraint lp_profiles_role_check
  check (role in ('admin', 'customer', 'publisher'));

-- 2. Application status + audit timestamps.
alter table public.lp_profiles
  add column if not exists publisher_status text not null default 'none'
    check (publisher_status in ('none', 'pending', 'approved', 'rejected')),
  add column if not exists publisher_applied_at timestamptz,
  add column if not exists publisher_reviewed_at timestamptz;

-- Existing publishers (if any were set manually) should read as approved.
update public.lp_profiles
  set publisher_status = 'approved'
  where role = 'publisher' and publisher_status <> 'approved';

-- Fast lookup of pending applications for the admin review screen.
create index if not exists lp_profiles_publisher_status_idx
  on public.lp_profiles (publisher_status);

-- 3. Lock down self-service column writes (security).
--    The "Users can update own profile" RLS policy (auth.uid() = id) does NOT
--    restrict which columns a user may set, so an authenticated user could
--    write role / publisher_status on their OWN row and self-promote —
--    bypassing admin approval (and, pre-existing, self-promote to admin).
--    Column-level privileges close this: authenticated users may update ONLY
--    full_name. All privileged transitions (apply -> pending, approve ->
--    publisher, reject) go through the service-role client in server actions,
--    which bypasses RLS and these grants.
revoke update on public.lp_profiles from authenticated;
grant  update (full_name) on public.lp_profiles to authenticated;
