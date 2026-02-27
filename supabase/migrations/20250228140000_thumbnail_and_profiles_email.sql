-- Add thumbnail_url to landing_pages
alter table public.landing_pages
  add column if not exists thumbnail_url text default null;

-- Add email to profiles for admin customer list
alter table public.profiles
  add column if not exists email text default null;


-- Admin can read customer profiles for dashboard
create policy "Admin can read customer profiles"
  on public.profiles for select
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
    and role = 'customer'
  );

-- Update trigger to set email from auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'customer'
  );
  return new;
end;
$$ language plpgsql security definer;
