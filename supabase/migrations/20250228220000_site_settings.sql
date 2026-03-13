-- Site settings: key-value store (e.g. custom_js for admin-injected scripts)
create table public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

alter table public.site_settings enable row level security;

-- Anyone can read (custom_js is injected on public pages)
create policy "Public can read site_settings"
  on public.site_settings for select
  using (true);

-- Only admins can update (via service role or RLS with admin check)
-- Use function to avoid recursion like profiles
create policy "Admin can update site_settings"
  on public.site_settings for update
  using (public.get_my_profile_role() = 'admin');

create policy "Admin can insert site_settings"
  on public.site_settings for insert
  with check (public.get_my_profile_role() = 'admin');
