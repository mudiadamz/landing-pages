-- Backfill profiles for existing users (set as admin so they can manage)
insert into public.profiles (id, full_name, role)
select id, raw_user_meta_data->>'full_name', 'admin'
from auth.users
where id not in (select id from public.profiles);
