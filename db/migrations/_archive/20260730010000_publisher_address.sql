-- Current residential address for publisher applications.
--
-- Collected alongside the KTP photo so an admin can check the applicant is
-- reachable and that the person matches the document. A KTP carries the address
-- printed when it was issued, which is often no longer where someone lives —
-- hence "current", asked for separately rather than read off the card.
alter table public.lp_profiles
  add column if not exists publisher_address text;

comment on column public.lp_profiles.publisher_address is
  'Current residential address of the applicant. Admin-facing only — never render publicly.';

-- Same protection as the rest of the application fields, inherited rather than
-- restated: 20260713000000_publisher_role.sql revoked UPDATE on this table from
-- authenticated and granted it back for full_name alone, so a signed-in user
-- cannot write this column through the public API. applyAsPublisher() sets it
-- with the service role after authenticating the caller, and the existing RLS
-- SELECT policies keep it readable only by its owner (anon matches none).
