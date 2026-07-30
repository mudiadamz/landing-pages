-- Email capture from the promo popup on the preview.
--
-- The campaign analysis on 30 Jul found no return path at all: paid traffic
-- arrives, 94% never reach the end-of-part CTA, and nothing brings them back.
-- This is that path — an address volunteered mid-read, which is the only moment
-- a reader has actually shown interest.
create table if not exists public.lp_promo_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  -- Which preview they were reading when they subscribed; tells us which story
  -- earns addresses, not just which earns clicks.
  source_slug text,
  created_at  timestamptz not null default now(),
  -- One row per address. A reader who subscribes twice is not two readers.
  constraint lp_promo_subscribers_email_key unique (email)
);

create index if not exists lp_promo_subscribers_created_idx
  on public.lp_promo_subscribers (created_at desc);

alter table public.lp_promo_subscribers enable row level security;

-- No policies, deliberately.
--
-- Anonymous readers are the ones subscribing, so a public INSERT policy would
-- let anyone enumerate or flood the table through the REST API. The server
-- action writes with the service role after validating the address instead, and
-- reads are admin-only by construction — with RLS on and no policy, nothing
-- reaches this table through the public API at all.
