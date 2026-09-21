-- Login-gated "like" for products. One like per user per product; a cached
-- like_count on lp_landing_pages is kept in sync by a trigger so public pages can
-- show the total without an aggregate query.
alter table lp_landing_pages
  add column if not exists like_count integer not null default 0;

create table if not exists lp_product_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  landing_page_id uuid not null references lp_landing_pages (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, landing_page_id)
);

create index if not exists lp_product_likes_page_idx on lp_product_likes (landing_page_id);

alter table lp_product_likes enable row level security;

-- A user manages only their own likes.
drop policy if exists "read own likes" on lp_product_likes;
create policy "read own likes" on lp_product_likes
  for select using (auth.uid() = user_id);
drop policy if exists "insert own likes" on lp_product_likes;
create policy "insert own likes" on lp_product_likes
  for insert with check (auth.uid() = user_id);
drop policy if exists "delete own likes" on lp_product_likes;
create policy "delete own likes" on lp_product_likes
  for delete using (auth.uid() = user_id);

-- Keep the cached counter in sync with inserts/deletes.
create or replace function lp_sync_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update lp_landing_pages set like_count = like_count + 1 where id = new.landing_page_id;
  elsif (tg_op = 'DELETE') then
    update lp_landing_pages set like_count = greatest(like_count - 1, 0) where id = old.landing_page_id;
  end if;
  return null;
end;
$$;

drop trigger if exists lp_product_likes_count on lp_product_likes;
create trigger lp_product_likes_count
  after insert or delete on lp_product_likes
  for each row execute function lp_sync_like_count();
