-- Fix infinite recursion: "Admin can read customer profiles" policy queried profiles
-- and triggered RLS again. Use a SECURITY DEFINER function to get current user's role
-- without going through RLS.

create or replace function public.get_my_profile_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

-- Replace the policy to use the function instead of a subquery on profiles
drop policy if exists "Admin can read customer profiles" on public.profiles;
create policy "Admin can read customer profiles"
  on public.profiles for select
  using (
    public.get_my_profile_role() = 'admin'
    and role = 'customer'
  );
