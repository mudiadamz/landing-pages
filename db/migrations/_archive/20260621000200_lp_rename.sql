-- =====================================================================
-- Rename the landing_pages project's own objects to the `lp_` prefix, so
-- all three merged projects (lp_/pp_/tp_) are consistently namespaced.
--
-- This is a FORWARD migration (ALTER ... RENAME) — the 18 historical
-- migrations are NOT rewritten; they already ran on the live host DB.
--
-- RENAME preserves object OIDs, so dependent indexes, FK constraints, RLS
-- policies, and triggers follow automatically. The only things that must
-- be re-emitted are plpgsql/sql function BODIES that reference a renamed
-- table by NAME (resolved at runtime), which would otherwise break.
-- =====================================================================

-- 1. Tables (policies, indexes, FKs, triggers move with the table) -------
alter table public.landing_pages            rename to lp_landing_pages;
alter table public.landing_page_versions    rename to lp_landing_page_versions;
alter table public.profiles                 rename to lp_profiles;
alter table public.purchases                rename to lp_purchases;
alter table public.contacts                 rename to lp_contacts;
alter table public.landing_page_categories  rename to lp_landing_page_categories;
alter table public.received_emails          rename to lp_received_emails;
alter table public.site_settings            rename to lp_site_settings;
alter table public.reviews                  rename to lp_reviews;

-- 2. Functions (dependent triggers/policies follow by OID) ---------------
alter function public.set_updated_at()                 rename to lp_set_updated_at;
alter function public.handle_new_user()                rename to lp_handle_new_user;
alter function public.update_landing_page_sold_count() rename to lp_update_landing_page_sold_count;
alter function public.get_my_profile_role()            rename to lp_get_my_profile_role;
alter function public.update_landing_page_rating()     rename to lp_update_landing_page_rating;

-- 3. Triggers ------------------------------------------------------------
alter trigger landing_pages_updated_at      on public.lp_landing_pages rename to lp_landing_pages_updated_at;
alter trigger purchases_sold_count_trigger  on public.lp_purchases     rename to lp_purchases_sold_count_trigger;
alter trigger reviews_rating_trigger        on public.lp_reviews       rename to lp_reviews_rating_trigger;

-- auth.users is owned by supabase_auth_admin, so renaming a trigger on it
-- requires ownership (CREATE TRIGGER only needs the TRIGGER privilege).
-- Try the rename for lp_ consistency; if the migration role can't, leave it
-- as on_auth_user_created — it already calls the renamed lp_handle_new_user
-- (OID-stable) and writes lp_profiles, so it stays functionally correct and
-- does not collide with texas-poker's tp_on_auth_user_created.
do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
      and not tgisinternal
  ) then
    begin
      execute 'alter trigger on_auth_user_created on auth.users rename to lp_on_auth_user_created';
    exception when insufficient_privilege then
      begin
        execute 'set local role supabase_auth_admin';
        execute 'alter trigger on_auth_user_created on auth.users rename to lp_on_auth_user_created';
        execute 'reset role';
      exception when others then
        execute 'reset role';
        raise notice 'lp_rename: kept auth trigger name on_auth_user_created (no privilege to rename); it still calls lp_handle_new_user';
      end;
    end;
  end if;
end $$;

-- 4. Re-emit function bodies that reference renamed tables by name -------
--    (CREATE OR REPLACE keeps the OID, so triggers/policies stay bound.)

-- Writes a profile row on signup. References lp_profiles now.
create or replace function public.lp_handle_new_user()
returns trigger as $$
begin
  insert into public.lp_profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'customer'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Keeps lp_landing_pages.sold_count in sync with lp_purchases.
create or replace function public.lp_update_landing_page_sold_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.lp_landing_pages
    set sold_count = sold_count + 1
    where id = new.landing_page_id;
  elsif tg_op = 'DELETE' then
    update public.lp_landing_pages
    set sold_count = greatest(0, sold_count - 1)
    where id = old.landing_page_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

-- RLS helper: current user's role without recursing through RLS.
create or replace function public.lp_get_my_profile_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.lp_profiles where id = auth.uid() limit 1;
$$;

-- Keeps lp_landing_pages.rating in sync as the average of lp_reviews.
create or replace function public.lp_update_landing_page_rating()
returns trigger as $$
declare
  target_id uuid;
begin
  if tg_op = 'DELETE' then
    target_id := old.landing_page_id;
  else
    target_id := new.landing_page_id;
  end if;

  update public.lp_landing_pages
  set rating = (
    select round(avg(r.rating)::numeric, 2)
    from public.lp_reviews r
    where r.landing_page_id = target_id
  )
  where id = target_id;

  return null;
end;
$$ language plpgsql security definer;

-- set_updated_at has no table reference, so no body change is needed.
