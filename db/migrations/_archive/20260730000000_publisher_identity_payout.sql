-- Publisher application: legal identity, public store name, T&C acceptance and
-- payout details.
--
-- Two names, deliberately separate:
--   publisher_real_name    — must match the KTP, so an admin can compare it
--                            against the uploaded photo. Never displayed publicly.
--   publisher_display_name — the store name buyers would see. Chosen freely.
--
-- Splitting them is the point of the feature: a seller should not have to
-- publish their legal name to trade.
alter table public.lp_profiles
  add column if not exists publisher_real_name        text,
  add column if not exists publisher_display_name     text,
  -- When the applicant accepted the publisher terms. Null = never accepted.
  -- A timestamp rather than a boolean so it is auditable against the terms
  -- text in force at that moment.
  add column if not exists publisher_terms_accepted_at timestamptz,
  -- Payout target. Free text on purpose: Indonesian banks, e-wallets and the
  -- newer digital banks have no shared account-number format worth validating,
  -- and a wrong regex here silently blocks legitimate sellers.
  add column if not exists publisher_bank_name        text,
  add column if not exists publisher_bank_holder      text,
  add column if not exists publisher_bank_account     text;

comment on column public.lp_profiles.publisher_real_name is
  'Legal name as printed on the KTP. Admin-facing only — never render publicly.';
comment on column public.lp_profiles.publisher_display_name is
  'Public store/publisher name. Safe to display.';
comment on column public.lp_profiles.publisher_bank_account is
  'Payout account number. Admin-facing only.';

-- Writes stay server-side.
--
-- 20260713000000_publisher_role.sql revoked UPDATE on this table from
-- authenticated and granted it back for exactly one column (full_name), so the
-- columns added above are already unwritable by a signed-in user through the
-- public API. applyAsPublisher() sets them with the service role after
-- authenticating the caller — the same shape the KYC photo paths already use.
--
-- Reads are covered by the existing RLS policies: a user sees only their own
-- row, and anon matches no SELECT policy at all, so bank details and legal
-- names are unreachable anonymously. Admin review reads through the service
-- role in lib/actions/admin.ts.
--
-- No index: these columns are only ever read by primary key.
