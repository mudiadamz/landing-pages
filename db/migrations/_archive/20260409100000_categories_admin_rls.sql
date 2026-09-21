-- Allow admins to manage categories (insert, update, delete)
create policy "Admin can insert categories"
  on public.landing_page_categories for insert
  with check (public.get_my_profile_role() = 'admin');

create policy "Admin can update categories"
  on public.landing_page_categories for update
  using (public.get_my_profile_role() = 'admin');

create policy "Admin can delete categories"
  on public.landing_page_categories for delete
  using (public.get_my_profile_role() = 'admin');
