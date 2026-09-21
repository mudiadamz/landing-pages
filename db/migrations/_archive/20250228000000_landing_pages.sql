-- landing_pages table
create table public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  html_content text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade
);

-- RLS: only authenticated users can CRUD their own; public can read for /lp/[slug]
alter table public.landing_pages enable row level security;

create policy "Users can manage own landing pages"
  on public.landing_pages for all
  using (auth.uid() = user_id);

create policy "Public can read landing pages"
  on public.landing_pages for select
  using (true);

-- Optional: trigger to set updated_at on update
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger landing_pages_updated_at
  before update on public.landing_pages
  for each row
  execute function public.set_updated_at();
