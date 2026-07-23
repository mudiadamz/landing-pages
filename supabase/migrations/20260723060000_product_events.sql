-- Per-product visitor analytics: one row per tracked event (page view, session
-- duration ping, or CTA action). Written by the /api/track route via the service
-- role (bypasses RLS); read only by the product's owner.
create table if not exists lp_product_events (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references lp_landing_pages (id) on delete cascade,
  session_id text,
  kind text not null,               -- 'view' | 'session' | 'cta'
  page text,                        -- 'preview' | 'checkout'
  referrer_host text,               -- external referrer host; null = direct
  device text,                      -- 'mobile' | 'tablet' | 'desktop'
  browser text,
  os text,
  duration_ms bigint,               -- active time for 'session' events
  cta_action text,                  -- action name for 'cta' events
  created_at timestamptz not null default now()
);

create index if not exists lp_product_events_page_idx
  on lp_product_events (landing_page_id, created_at desc);

alter table lp_product_events enable row level security;

-- Only the owner of the product may read its events (panel stats). Inserts come
-- from the service-role route, which bypasses RLS, so there is no insert policy.
drop policy if exists "owner reads product events" on lp_product_events;
create policy "owner reads product events" on lp_product_events
  for select
  using (
    exists (
      select 1 from lp_landing_pages p
      where p.id = lp_product_events.landing_page_id
        and p.user_id = auth.uid()
    )
  );
