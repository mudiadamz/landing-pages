-- Which storefront did this happen on?
--
-- Until now: nothing recorded it. Products belong to categories, purchases belong to
-- users, and sessions recorded `referrer_host` — which is where the visitor came FROM
-- (instagram.com), not which of our domains they landed on. So the panel could not
-- answer "how did resepku.com do this month", and the site selector had nothing to
-- filter Penjualan, Analytics or Kontak by.
--
-- Nullable, and every existing row stays NULL. Attribution cannot be back-filled: the
-- information was never captured. The panel therefore reads NULL as belonging to the
-- canonical site, which is where effectively all of this history was recorded — see
-- lib/site-scope.ts. That keeps the main site's numbers whole and starts a niche
-- domain from zero rather than inheriting someone else's traffic.
--
-- ON DELETE SET NULL, never CASCADE. Removing a domain must not delete purchases,
-- reviews or the sales history that goes with them — the row loses its attribution and
-- nothing else. (lp_site_settings does cascade, deliberately: a hero belongs to its
-- domain and is meaningless without it. A payment is not.)

alter table public.lp_sessions
  add column if not exists site_id uuid references public.lp_sites(id) on delete set null;
alter table public.lp_page_events
  add column if not exists site_id uuid references public.lp_sites(id) on delete set null;
alter table public.lp_purchases
  add column if not exists site_id uuid references public.lp_sites(id) on delete set null;
alter table public.lp_contacts
  add column if not exists site_id uuid references public.lp_sites(id) on delete set null;
alter table public.lp_reviews
  add column if not exists site_id uuid references public.lp_sites(id) on delete set null;

-- Every panel screen filters by this, so each table gets its own index. Partial
-- (WHERE site_id IS NOT NULL): the NULL rows are the historical bulk and no query
-- looks them up BY site_id — they are picked up by the canonical branch's IS NULL,
-- which an index on a mostly-NULL column would not help anyway.
create index if not exists lp_sessions_site_idx
  on public.lp_sessions (site_id) where site_id is not null;
create index if not exists lp_page_events_site_idx
  on public.lp_page_events (site_id) where site_id is not null;
create index if not exists lp_purchases_site_idx
  on public.lp_purchases (site_id) where site_id is not null;
create index if not exists lp_contacts_site_idx
  on public.lp_contacts (site_id) where site_id is not null;
create index if not exists lp_reviews_site_idx
  on public.lp_reviews (site_id) where site_id is not null;

comment on column public.lp_purchases.site_id is
  'Storefront the purchase was made on. NULL = recorded before attribution existed; the panel counts those with the canonical site.';
comment on column public.lp_sessions.site_id is
  'Storefront the visit landed on. Distinct from referrer_host, which is where the visitor came from.';

-- lp_track_session upserts the session row, so attribution has to go through it too.
--
-- A NEW parameter appended at the end with a default, not a changed signature: the
-- running deployment calls this function with the old argument list, and a deploy is
-- not atomic with a migration. Without the default, every session write between the two
-- would fail — silently, because the tracking route swallows its own errors by design.
--
-- site_id is set on INSERT only. A session belongs to the domain it started on; a
-- visitor who follows a link to another storefront starts a new session there, and
-- overwriting on conflict would let the last pageview rewrite the visit's origin.
create or replace function lp_track_session(
  p_session_id text, p_visitor_id text, p_user_id uuid,
  p_ip text, p_country text, p_region text, p_city text, p_isp text,
  p_referrer text, p_referrer_host text, p_landing_path text, p_entry_product_id uuid,
  p_utm_source text, p_utm_medium text, p_utm_campaign text, p_utm_term text, p_utm_content text,
  p_device text, p_browser text, p_os text,
  p_dwell_ms bigint,
  p_site_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into lp_sessions (
    session_id, visitor_id, user_id, ip, country, region, city, isp,
    referrer, referrer_host, landing_path, entry_product_id,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    device, browser, os, site_id, pageviews, active_ms, started_at, last_seen_at
  ) values (
    p_session_id, p_visitor_id, p_user_id, p_ip, p_country, p_region, p_city, p_isp,
    p_referrer, p_referrer_host, p_landing_path, p_entry_product_id,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content,
    p_device, p_browser, p_os, p_site_id, 1, greatest(p_dwell_ms, 0), now(), now()
  )
  on conflict (session_id) do update set
    last_seen_at = now(),
    pageviews = lp_sessions.pageviews + 1,
    active_ms = lp_sessions.active_ms + greatest(p_dwell_ms, 0),
    user_id = coalesce(lp_sessions.user_id, excluded.user_id);
end;
$$;
