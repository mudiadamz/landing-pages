-- Business signup / onboarding — docs/plans/multi-business-saas.md, Fase 4.
--
-- A logged-in user asks to run a Business; the row lands `status = 'pending'` and
-- the Platform approves or rejects it. Nothing here moves money or touches auth —
-- it only adds the three application fields the Platform reads to make that call,
-- plus the owner-membership the applicant gets so the business isn't orphaned.
--
-- lp_businesses stays service-role-only (Fase 0): applies/approvals run through the
-- service_role client behind their own gate (login + eligibility, or requirePlatform),
-- exactly like the rest of the Platform surface. So no new policy or grant is needed —
-- only additive, nullable columns.

alter table public.lp_businesses add column contact_email text;
alter table public.lp_businesses add column desired_host  text;
alter table public.lp_businesses add column note          text;

-- Who applied and when the Platform last acted — a thin audit trail so a pending
-- queue can show "requested 3 days ago" without joining the membership table.
alter table public.lp_businesses add column applied_by  uuid references auth.users(id) on delete set null;
alter table public.lp_businesses add column reviewed_at timestamptz;
