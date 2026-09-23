-- Payout execution — docs/plans/multi-business-saas.md, Fase 3 (sisa: disbursement).
--
-- Until now a payout was a single ledger row meaning "a human transferred this at
-- the bank". That is enough to stop the money being paid twice, but it records
-- nothing about the transfer itself: no destination, no provider reference, no
-- way to tell "we never sent it" from "we sent it and it failed". A disbursement
-- API needs all three, because the interesting cases are the ones where our side
-- and the provider's side disagree.
--
-- So: lp_business_payouts is the payout's own life story, one row per attempt,
-- with the ledger row it debits named in `ledger_ref`. The UNIQUE on that column
-- is the idempotency anchor — one payout per reference, so a retried request
-- cannot become a second transfer.
--
-- Manual payouts get a row too (method 'manual', status 'sent'): one history,
-- one screen, whether a human or an API moved the money.
--
-- RLS: service-role only, like the other three business tables (Fase 0). Payout
-- data is destination bank details; no anon or authenticated policy exists, and
-- the Platform reaches it through the service-role client behind requirePlatform.

create table public.lp_business_payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.lp_businesses(id) on delete cascade,
  amount bigint not null check (amount > 0),
  -- How the money moved. 'manual' = a human at a banking app; the rest are
  -- disbursement providers.
  method text not null default 'manual' check (method in ('manual', 'duitku')),
  -- recorded → booked, nothing sent (manual bookkeeping of an older transfer)
  -- pending  → handed to the provider, outcome not yet known. NEVER auto-reversed:
  --            "we don't know" must not be read as "it didn't happen".
  -- sent     → provider confirmed
  -- failed   → provider refused; a compensating ledger row gives the money back
  status text not null default 'recorded'
    check (status in ('recorded', 'pending', 'sent', 'failed')),
  -- order_ref of the ledger row this payout debits. One payout per reference.
  ledger_ref text not null unique,
  -- Destination, snapshotted: the business may edit its bank details later, and a
  -- payout history that silently repoints is not a history.
  bank_code text,
  bank_account text,
  bank_holder text,
  -- Provider identifiers: disburseId and custRefNumber for Duitku.
  provider_ref text,
  cust_ref text,
  error text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lp_business_payouts_business_idx
  on public.lp_business_payouts(business_id, created_at desc);
alter table public.lp_business_payouts enable row level security;
grant all on table public.lp_business_payouts to anon, authenticated, service_role;
create policy "Service role manages lp_business_payouts" on public.lp_business_payouts
  to service_role using (true) with check (true);

-- A bank CODE, next to the name the business typed. Disbursement APIs address
-- banks by code ("014" = BCA); free text cannot be mapped to one reliably, and
-- guessing the wrong bank sends real money to a real stranger.
alter table public.lp_businesses add column payout_bank_code text;
