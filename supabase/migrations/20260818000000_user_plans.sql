-- User plans: Free, Pro, Business, Enterprise.
--
-- Two columns on the profile and one table for what was paid. The LIMITS are not
-- here at all — they live in lib/plans.ts, for the same reason templates and
-- palettes do (invariant I12): changing what Pro includes is a code change with a
-- review, not a migration, and an unknown value in the column degrades to `free`
-- instead of breaking the page.
--
-- Prices are not here either. They are per-storefront settings, so they live in
-- lp_site_settings under `plan_prices`, edited at /panel/plans.

-- -- the plan a profile is on ------------------------------------------------
alter table public.lp_profiles
  add column if not exists plan text not null default 'free';

/**
 * When a paid plan lapses back to free. NULL means it does not lapse — which is
 * what an admin-granted plan is, and what `free` always is.
 *
 * Expiry is read in code rather than swept by a job: a nightly sweep would leave
 * a window where the row says Pro and the plan has ended, and every reader would
 * have to distrust the column anyway. One comparison at read time cannot drift.
 */
alter table public.lp_profiles
  add column if not exists plan_expires_at timestamptz;

comment on column public.lp_profiles.plan is
  'Plan key validated against lib/plans.ts (free|pro|business|enterprise). Unknown values read as free.';

-- Answers "who is on a paid plan, and whose is about to lapse" without a scan.
create index if not exists lp_profiles_plan_idx
  on public.lp_profiles (plan, plan_expires_at);

-- -- what was paid for it ----------------------------------------------------
create table if not exists public.lp_plan_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Which storefront sold it. Recorded for attribution, exactly as lp_purchases
  -- does; the plan itself is on the account and follows the user everywhere.
  site_id uuid references public.lp_sites (id) on delete set null,
  plan text not null,
  /** Billing period bought, in months. The price per month is the site setting. */
  months integer not null default 1 check (months between 1 and 24),
  /** Rupiah, as an integer — the same shape lp_purchases.amount uses. */
  amount integer not null default 0,
  /**
   * The id sent to Duitku, and the reason a re-delivered callback is harmless.
   *
   * UNIQUE is the idempotency: Duitku retries a callback it did not get a 200
   * for, and without this a retry would extend the plan a second time for one
   * payment.
   */
  merchant_order_id text not null unique,
  invoice_number text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  paid_at timestamptz,
  /** What the profile's plan_expires_at was set to when this order was paid. */
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lp_plan_orders_user_idx
  on public.lp_plan_orders (user_id, created_at desc);

alter table public.lp_plan_orders enable row level security;

-- Buyers read their own receipts. Nobody writes through this client: orders are
-- created and settled by the payment routes with the service-role client, which
-- is what makes "paid" a statement from Duitku rather than from the browser.
drop policy if exists "Users read own plan orders" on public.lp_plan_orders;
create policy "Users read own plan orders"
  on public.lp_plan_orders for select
  using (auth.uid() = user_id);

drop policy if exists "Admin reads all plan orders" on public.lp_plan_orders;
create policy "Admin reads all plan orders"
  on public.lp_plan_orders for select
  using (public.lp_get_my_profile_role() = 'admin');
