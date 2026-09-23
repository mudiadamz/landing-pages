-- Fase 5 — matriks peran per-business, dan pensiunnya lp_profiles.account_type.
-- docs/plans/multi-business-saas.md
--
-- account_type was ONE GLOBAL VALUE answering a question that is never global:
-- "what may this person do HERE". It worked while there was one business. With a
-- second, every "Agent" is an agent of every business at once, which is not a
-- permission model — it is the absence of one.
--
-- What replaces it, in the places those facts belong:
--   lp_profiles.is_platform        the platform operator          (was 'company')
--   lp_business_members.role       owner | admin | staff, PER business (was 'agent')
--   neither                        an ordinary buyer              (was 'customer')
--
-- Order matters, and it is the order below: BACKFILL so the new model already
-- gives every existing person the same answer, then REDEFINE the function eleven
-- policies call, then rewrite the two policies that read the column directly,
-- and only then drop it. Dropping first would have been a window in which
-- everybody was a customer.

-- 1. Backfill ---------------------------------------------------------------
-- Fase 0 already did this once, from the state of the database that day. Any
-- account promoted since then has no membership, so it runs again — idempotently.

do $$
declare
  fallback_business uuid;
begin
  -- Company → Platform.
  update public.lp_profiles set is_platform = true
   where account_type = 'company' and not is_platform;

  -- Agent → admin of the business that owns a site they actually manage. This is
  -- the pairing the old model could not express, and it is why agents of a niche
  -- storefront end up in THAT business rather than in the default one.
  insert into public.lp_business_members (business_id, user_id, role)
  select distinct s.business_id, a.user_id, 'admin'
    from public.lp_site_agents a
    join public.lp_sites s on s.id = a.site_id
    join public.lp_profiles p on p.id = a.user_id
   where s.business_id is not null and p.account_type = 'agent'
  on conflict do nothing;

  -- An Agent who manages no site at all would otherwise lose everything at the
  -- moment the column disappears. The oldest business is the one the Fase 0
  -- backfill put all existing data in, so it is where they already worked.
  select id into fallback_business from public.lp_businesses order by created_at limit 1;
  if fallback_business is not null then
    insert into public.lp_business_members (business_id, user_id, role)
    select fallback_business, p.id, 'admin'
      from public.lp_profiles p
     where p.account_type = 'agent'
       and not exists (select 1 from public.lp_business_members m where m.user_id = p.id)
    on conflict do nothing;

    -- Platform accounts run the platform; they also own the original business,
    -- so the business is never left without an owner.
    insert into public.lp_business_members (business_id, user_id, role)
    select fallback_business, p.id, 'owner'
      from public.lp_profiles p
     where p.is_platform
       and not exists (select 1 from public.lp_business_members m where m.user_id = p.id)
    on conflict do nothing;
  end if;
end $$;

-- 2. The compatibility point -------------------------------------------------
-- Eleven policies call lp_get_my_profile_role(). Rewriting all eleven to speak
-- the new vocabulary would be eleven chances to get an RLS rule subtly wrong in
-- one migration. Instead this ONE function keeps its name and its three answers
-- and changes where they come from — so the column can go today, and the policies
-- can be reworded later, separately, when each is worth reading again.

create or replace function public.lp_get_my_profile_role() returns text
  language sql stable security definer
  set search_path to 'public'
  as $$
  select case
    when exists (select 1 from public.lp_profiles p
                  where p.id = auth.uid() and p.is_platform) then 'company'
    when exists (select 1 from public.lp_business_members m
                  where m.user_id = auth.uid() and m.role in ('owner', 'admin')) then 'agent'
    else 'customer'
  end;
$$;

comment on function public.lp_get_my_profile_role() is
  'Kedudukan pemanggil dalam KOSAKATA LAMA: company | agent | customer. Sejak Fase 5 ini DITURUNKAN, bukan dibaca: company = lp_profiles.is_platform, agent = owner/admin di lp_business_members, sisanya customer. Namanya dan nilainya dipertahankan karena 11 policy memanggilnya; lp_profiles.account_type sudah tidak ada.';

comment on function public.lp_can_sell() is
  'Pemanggil boleh membuat produk: Platform, pengelola business (owner/admin), atau publisher di salah satu situs. Versi database dari canSellProducts/canSellOnSite — lebih longgar karena produk belum punya site_id.';

-- 3. The two policies that read the column directly --------------------------

-- Was: role='company' AND account_type='customer'. The new reading is "the
-- Platform sees every profile that is not another Platform account" — slightly
-- wider, and correct: the Platform's user list has always shown business owners
-- too (it reads them with the service role), while another operator's row stays
-- behind the same extra step that protects it everywhere else.
drop policy "Admin can read customer profiles" on public.lp_profiles;
create policy "Platform reads non-platform profiles" on public.lp_profiles
  for select using (public.lp_get_my_profile_role() = 'company' and not is_platform);

-- Same meaning as before (platform only), sourced from the function instead of
-- from the column.
drop policy contacts_select_admin on public.lp_contacts;
create policy contacts_select_admin on public.lp_contacts
  for select to authenticated
  using (public.lp_get_my_profile_role() = 'company');

-- 4. The column goes ---------------------------------------------------------
-- Its index and CHECK constraint go with it. Any write grant naming it goes too,
-- which is the point: there is no longer a column through which somebody could
-- be handed a different kind of account.

alter table public.lp_profiles drop column account_type;

-- 5. The per-business feature matrix (Fase 5, the other half) ----------------
-- Which features `admin` and `staff` of THIS business get. NULL = never
-- configured → lib/role-permissions.ts applies the default (admin: everything,
-- staff: nothing), which is exactly what an Agent had under the old model.
--
-- A column on lp_businesses rather than a table: it is one small object read
-- with the business row it belongs to, and a new table would mean a new RLS
-- surface to get right for a value that only the owner and the Platform ever see.

alter table public.lp_businesses add column role_permissions jsonb;

comment on column public.lp_businesses.role_permissions is
  'Matriks fitur per peran business: {"admin": [...], "staff": [...]}. NULL = belum pernah diatur; default ada di lib/role-permissions.ts. Owner TIDAK ada di sini — owner selalu punya semuanya, dan owner yang bisa dikunci dari business-nya sendiri itu tiket support, bukan fitur.';
