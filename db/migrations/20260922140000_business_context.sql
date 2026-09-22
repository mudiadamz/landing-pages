-- Multi-business SaaS — docs/plans/multi-business-saas.md, Fase 1.
--
-- The in-database view of "which business is this request for". The app sets two
-- transaction-local GUCs in withRls (lib/backend/rls.ts) — app.business_id and
-- app.is_platform — next to the role/jwt it already sets; these functions read
-- them. Fase 2's RLS policies will be written against current_business() and
-- is_platform(); defining them now (unused) keeps that migration purely about
-- policies.

create or replace function public.current_business() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.business_id', true), '')::uuid $$;

create or replace function public.is_platform() returns boolean
  language sql stable
  as $$ select coalesce(nullif(current_setting('app.is_platform', true), ''), 'off') = 'on' $$;

grant execute on function public.current_business(), public.is_platform()
  to anon, authenticated, service_role;
