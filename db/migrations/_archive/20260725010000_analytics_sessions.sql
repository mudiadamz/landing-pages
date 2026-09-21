-- First-party session + journey analytics. Written only by the service-role
-- ingestion route (RLS on, no policies → no anon/public access); read only via
-- admin server actions using the admin client.

create table if not exists lp_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  visitor_id text,
  user_id uuid references auth.users (id) on delete set null,
  ip text,
  country text,
  region text,
  city text,
  isp text,
  referrer text,
  referrer_host text,
  landing_path text,
  entry_product_id uuid references lp_landing_pages (id) on delete set null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  device text,
  browser text,
  os text,
  pageviews integer not null default 0,
  active_ms bigint not null default 0,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists lp_sessions_started_idx on lp_sessions (started_at desc);
create index if not exists lp_sessions_campaign_idx on lp_sessions (utm_campaign);
create index if not exists lp_sessions_ref_idx on lp_sessions (referrer_host);
create index if not exists lp_sessions_user_idx on lp_sessions (user_id);
alter table lp_sessions enable row level security;

create table if not exists lp_page_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  visitor_id text,
  user_id uuid references auth.users (id) on delete set null,
  path text not null,
  product_id uuid references lp_landing_pages (id) on delete set null,
  product_slug text,
  page_type text,                 -- 'home' | 'preview' | 'checkout' | 'panel' | 'other'
  referrer_host text,
  dwell_ms integer not null default 0,
  scroll_depth integer not null default 0,   -- 0..100
  reached_end boolean not null default false,
  engagement text,                -- 'left' | 'curious' | 'read' (preview pages)
  created_at timestamptz not null default now()
);
create index if not exists lp_page_events_session_idx on lp_page_events (session_id);
create index if not exists lp_page_events_created_idx on lp_page_events (created_at desc);
create index if not exists lp_page_events_product_idx on lp_page_events (product_id);
alter table lp_page_events enable row level security;

-- Geo cache so each IP is looked up once, not per session.
create table if not exists lp_ip_geo (
  ip text primary key,
  country text,
  region text,
  city text,
  isp text,
  fetched_at timestamptz not null default now()
);
alter table lp_ip_geo enable row level security;

-- Atomic session upsert + counter increment (called by the service-role route).
create or replace function lp_track_session(
  p_session_id text, p_visitor_id text, p_user_id uuid,
  p_ip text, p_country text, p_region text, p_city text, p_isp text,
  p_referrer text, p_referrer_host text, p_landing_path text, p_entry_product_id uuid,
  p_utm_source text, p_utm_medium text, p_utm_campaign text, p_utm_term text, p_utm_content text,
  p_device text, p_browser text, p_os text,
  p_dwell_ms bigint
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into lp_sessions (
    session_id, visitor_id, user_id, ip, country, region, city, isp,
    referrer, referrer_host, landing_path, entry_product_id,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    device, browser, os, pageviews, active_ms, started_at, last_seen_at
  ) values (
    p_session_id, p_visitor_id, p_user_id, p_ip, p_country, p_region, p_city, p_isp,
    p_referrer, p_referrer_host, p_landing_path, p_entry_product_id,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content,
    p_device, p_browser, p_os, 1, greatest(p_dwell_ms, 0), now(), now()
  )
  on conflict (session_id) do update set
    last_seen_at = now(),
    pageviews = lp_sessions.pageviews + 1,
    active_ms = lp_sessions.active_ms + greatest(p_dwell_ms, 0),
    user_id = coalesce(lp_sessions.user_id, excluded.user_id);
end;
$$;
