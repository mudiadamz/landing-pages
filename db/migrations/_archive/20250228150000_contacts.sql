-- Contact form submissions
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

-- Anyone can submit (anon + authenticated)
create policy "contacts_insert"
  on public.contacts for insert
  to anon, authenticated
  with check (true);

-- Only admin can read (via profile role)
create policy "contacts_select_admin"
  on public.contacts for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

comment on table public.contacts is 'Contact form submissions; only admins can list.';
