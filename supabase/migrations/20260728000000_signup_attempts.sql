-- Per-address signup throttling.
--
-- Supabase has its own sign_in_sign_ups rate limit, but it is keyed on the IP
-- GoTrue sees — and every signup here is made server-side from a Vercel
-- function, so from Supabase's side the entire site shares a handful of egress
-- addresses. That limit protects the project as a whole; it can't tell one
-- visitor from another, and a flood would lock out real users along with the
-- bot. This table is what lets us count attempts per *visitor* and stop them
-- before the request reaches auth at all.
create table if not exists lp_signup_attempts (
  id bigserial primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

-- The only query: "how many from this ip since <cutoff>".
create index if not exists lp_signup_attempts_ip_time_idx
  on lp_signup_attempts (ip, created_at desc);

alter table lp_signup_attempts enable row level security;
-- No policies: written and read only by the service-role signup guard, same as
-- the analytics tables. Nothing in the browser ever touches it.
