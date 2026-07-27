-- IPs whose traffic is never counted. Complements the per-user exclusion:
-- a signed-out visitor can't be identified by account, so the owner's own
-- logged-out browsing (and office/staff networks) needs an address-based rule.
create table if not exists lp_excluded_ips (
  ip text primary key,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table lp_excluded_ips enable row level security;
-- No policies: written and read only by the service-role ingestion route and
-- admin server actions, same as the rest of the analytics tables.
