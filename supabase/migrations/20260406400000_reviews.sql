-- Reviews: users can rate & review purchased landing pages
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  landing_page_id uuid not null references public.landing_pages(id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  review_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, landing_page_id)
);

create index idx_reviews_landing_page on public.reviews(landing_page_id);
create index idx_reviews_user on public.reviews(user_id);

alter table public.reviews enable row level security;

create policy "Users can read all reviews"
  on public.reviews for select
  using (true);

create policy "Users can insert own reviews"
  on public.reviews for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reviews"
  on public.reviews for update
  using (auth.uid() = user_id);

-- Trigger: keep landing_pages.rating in sync as the average of all reviews
create or replace function public.update_landing_page_rating()
returns trigger as $$
declare
  target_id uuid;
begin
  if tg_op = 'DELETE' then
    target_id := old.landing_page_id;
  else
    target_id := new.landing_page_id;
  end if;

  update public.landing_pages
  set rating = (
    select round(avg(r.rating)::numeric, 2)
    from public.reviews r
    where r.landing_page_id = target_id
  )
  where id = target_id;

  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists reviews_rating_trigger on public.reviews;
create trigger reviews_rating_trigger
  after insert or update or delete on public.reviews
  for each row
  execute function public.update_landing_page_rating();
