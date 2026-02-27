-- Profiles: full_name, role (admin | customer)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer' check (role in ('admin', 'customer'))
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Allow insert from service/trigger
create policy "Enable insert for authenticated users"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Trigger: create profile on signup with role=customer
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'customer'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Purchases: track which landing pages a customer has bought
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  landing_page_id uuid not null references public.landing_pages(id) on delete cascade,
  purchased_at timestamptz default now(),
  unique(user_id, landing_page_id)
);

create index idx_purchases_user_id on public.purchases(user_id);

alter table public.purchases enable row level security;

create policy "Users can read own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

create policy "Users can insert own purchases"
  on public.purchases for insert
  with check (auth.uid() = user_id);
