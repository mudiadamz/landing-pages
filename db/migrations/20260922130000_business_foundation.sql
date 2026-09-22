-- Multi-business SaaS foundation — docs/plans/multi-business-saas.md, Fase 0.
--
-- Adds the Business tenant tables and a nullable business_id across the main
-- data tables, then backfills every existing row into ONE default business. No
-- application code reads any of this yet, so behaviour is unchanged; this is the
-- backbone later phases scope onto.
--
-- RLS: the three new tables are service-role only for now (Platform code uses the
-- service_role client). anon/authenticated get no policy → denied, exactly like
-- other private tables. Grants on the new business_id columns are SELECT-only for
-- anon/authenticated so `select` keeps working; nobody but migrations and
-- service_role writes business_id in this phase.

-- 1. Tenant tables ----------------------------------------------------------

create table public.lp_businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_type text not null default 'individual'
    check (business_type in ('individual', 'company')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'pending')),
  plan text not null default 'free',
  commission_pct numeric(5,2) not null default 10,
  kyc_status text not null default 'none'
    check (kyc_status in ('none', 'pending', 'approved', 'rejected')),
  payout_bank_name text,
  payout_bank_account text,
  payout_bank_holder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lp_businesses enable row level security;
grant all on table public.lp_businesses to anon, authenticated, service_role;
create policy "Service role manages lp_businesses" on public.lp_businesses
  to service_role using (true) with check (true);

create table public.lp_business_members (
  business_id uuid not null references public.lp_businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index lp_business_members_user_idx on public.lp_business_members(user_id);
alter table public.lp_business_members enable row level security;
grant all on table public.lp_business_members to anon, authenticated, service_role;
create policy "Service role manages lp_business_members" on public.lp_business_members
  to service_role using (true) with check (true);

create table public.lp_business_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.lp_businesses(id) on delete cascade,
  kind text not null
    check (kind in ('sale', 'commission', 'payout', 'refund', 'adjustment', 'chargeback')),
  amount_cents bigint not null,
  status text not null default 'pending' check (status in ('pending', 'available')),
  order_ref text,
  available_at timestamptz,
  created_at timestamptz not null default now()
);
create index lp_business_ledger_business_idx on public.lp_business_ledger(business_id, created_at);
alter table public.lp_business_ledger enable row level security;
grant all on table public.lp_business_ledger to anon, authenticated, service_role;
create policy "Service role manages lp_business_ledger" on public.lp_business_ledger
  to service_role using (true) with check (true);

-- 2. business_id (nullable) + is_platform -----------------------------------
-- SELECT-only grants: the columns are readable (so `select` never trips a
-- column-privilege error) but only migrations / service_role write them here.

alter table public.lp_sites add column business_id uuid references public.lp_businesses(id);
grant select (business_id) on public.lp_sites to anon, authenticated;

alter table public.lp_profiles add column business_id uuid references public.lp_businesses(id);
alter table public.lp_profiles add column is_platform boolean not null default false;
grant select (business_id, is_platform) on public.lp_profiles to anon, authenticated;

alter table public.lp_landing_pages add column business_id uuid references public.lp_businesses(id);
grant select (business_id) on public.lp_landing_pages to anon, authenticated;

alter table public.lp_landing_page_categories add column business_id uuid references public.lp_businesses(id);
grant select (business_id) on public.lp_landing_page_categories to anon, authenticated;

alter table public.lp_purchases add column business_id uuid references public.lp_businesses(id);
grant select (business_id) on public.lp_purchases to anon, authenticated;

alter table public.lp_plan_orders add column business_id uuid references public.lp_businesses(id);
grant select (business_id) on public.lp_plan_orders to anon, authenticated;

alter table public.lp_site_settings add column business_id uuid references public.lp_businesses(id);
grant select (business_id) on public.lp_site_settings to anon, authenticated;

-- 3. Backfill: one default business owns everything that exists today --------

do $$
declare
  biz uuid;
  canonical_name text;
begin
  select name into canonical_name
    from public.lp_sites where is_canonical order by created_at limit 1;

  insert into public.lp_businesses (name, slug, business_type)
  values (coalesce(nullif(trim(canonical_name), ''), 'Default'), 'default', 'company')
  returning id into biz;

  update public.lp_sites                    set business_id = biz where business_id is null;
  update public.lp_profiles                 set business_id = biz where business_id is null;
  update public.lp_landing_pages            set business_id = biz where business_id is null;
  update public.lp_landing_page_categories  set business_id = biz where business_id is null;
  update public.lp_purchases                set business_id = biz where business_id is null;
  update public.lp_plan_orders              set business_id = biz where business_id is null;
  update public.lp_site_settings            set business_id = biz where business_id is null;

  -- The existing platform owner(s): today's Company accounts run the platform.
  update public.lp_profiles set is_platform = true where account_type = 'company';

  -- Seed business membership from the old model: Company → owner, Agent → admin.
  insert into public.lp_business_members (business_id, user_id, role)
  select biz, id, case when account_type = 'company' then 'owner' else 'admin' end
    from public.lp_profiles
   where account_type in ('company', 'agent')
  on conflict do nothing;
end $$;
