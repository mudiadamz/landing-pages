-- Inbound emails received via Resend webhook (admin@admuiux.com)
create table public.received_emails (
  id uuid primary key default gen_random_uuid(),
  resend_email_id text not null unique,
  from_address text not null,
  from_name text,
  to_addresses text[] not null default '{}',
  subject text not null default '',
  body_text text,
  body_html text,
  received_at timestamptz not null,
  created_at timestamptz default now()
);

create index idx_received_emails_received_at on public.received_emails(received_at desc);

alter table public.received_emails enable row level security;

-- Insert from webhook uses service role (bypasses RLS). Authenticated users can read (panel admin check in app).
create policy "Authenticated can read received_emails"
  on public.received_emails for select
  using (auth.role() = 'authenticated');
