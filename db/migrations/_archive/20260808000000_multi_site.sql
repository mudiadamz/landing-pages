-- Multi-domain: one deployment, one catalog, several niche storefronts.
--
-- A "site" is a hostname plus the slice of the catalog it shows. Products are NOT
-- duplicated per site: each site names the root categories it covers, and the
-- existing parent -> child category filtering does the rest. A product moves
-- between storefronts by changing its category, and can appear on several.
--
-- Exactly one site is canonical (is_canonical). That one owns /panel, the Duitku
-- server-to-server callback URL, and is the fallback for any host we don't know
-- (preview deployments, *.vercel.app, a domain pointed at us before it's added).

create table if not exists public.lp_sites (
  id uuid primary key default gen_random_uuid(),
  -- Lowercase hostname, no port and no scheme: "resepku.com".
  host text not null unique,
  name text not null,
  tagline text,
  -- Root categories this storefront covers. EMPTY MEANS THE WHOLE CATALOG, which
  -- is what the canonical site wants — not "show nothing".
  category_ids uuid[] not null default '{}',
  is_canonical boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one canonical site. A partial unique index says that without blocking
-- the many rows that are simply not canonical.
create unique index if not exists lp_sites_one_canonical_idx
  on public.lp_sites (is_canonical)
  where is_canonical;

create index if not exists lp_sites_active_idx on public.lp_sites (active);

alter table public.lp_sites enable row level security;

-- Hostnames are not secrets, and the host -> site lookup runs on the anon client
-- (it happens inside unstable_cache, which refuses cookie-based clients).
drop policy if exists "Public can read lp_sites" on public.lp_sites;
create policy "Public can read lp_sites"
  on public.lp_sites for select
  using (true);

drop policy if exists "Admin can insert lp_sites" on public.lp_sites;
create policy "Admin can insert lp_sites"
  on public.lp_sites for insert
  with check (public.lp_get_my_profile_role() = 'admin');

drop policy if exists "Admin can update lp_sites" on public.lp_sites;
create policy "Admin can update lp_sites"
  on public.lp_sites for update
  using (public.lp_get_my_profile_role() = 'admin');

drop policy if exists "Admin can delete lp_sites" on public.lp_sites;
create policy "Admin can delete lp_sites"
  on public.lp_sites for delete
  using (public.lp_get_my_profile_role() = 'admin');

-- The existing production domain becomes the canonical site, covering everything.
insert into public.lp_sites (host, name, tagline, is_canonical, active)
values ('admuiux.com', 'ADM.UIUX', 'Produk digital siap pakai', true, true)
on conflict (host) do nothing;

/* ---------------------------------------------------------------------------
   lp_site_settings was keyed by `key` alone, which made every setting global —
   one hero, one popup, one tracking id for all domains. Re-key it per site.
--------------------------------------------------------------------------- */

alter table public.lp_site_settings
  add column if not exists site_id uuid references public.lp_sites (id) on delete cascade;

-- Existing settings belong to the domain that has been serving them.
update public.lp_site_settings s
set site_id = (select id from public.lp_sites where is_canonical limit 1)
where s.site_id is null;

alter table public.lp_site_settings alter column site_id set not null;

do $$
begin
  -- Swap the primary key from (key) to (site_id, key) so each site carries its
  -- own copy of every setting. Named constraints differ between the original
  -- table and the pp/tp/lp rename pass, so discover it rather than guess.
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.lp_site_settings'::regclass and contype = 'p'
  ) then
    execute (
      select format('alter table public.lp_site_settings drop constraint %I', conname)
      from pg_constraint
      where conrelid = 'public.lp_site_settings'::regclass and contype = 'p'
    );
  end if;
end $$;

alter table public.lp_site_settings
  add constraint lp_site_settings_pkey primary key (site_id, key);
