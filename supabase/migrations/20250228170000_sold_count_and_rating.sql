-- Add sold_count and rating to landing_pages
alter table public.landing_pages
  add column if not exists sold_count integer not null default 0,
  add column if not exists rating numeric(3,2) default null;

comment on column public.landing_pages.sold_count is 'Number of purchases (kept in sync via trigger)';
comment on column public.landing_pages.rating is 'Display rating e.g. 4.5 (optional, for display)';

-- Backfill sold_count from existing purchases
update public.landing_pages lp
set sold_count = (
  select count(*)::integer
  from public.purchases p
  where p.landing_page_id = lp.id
);

-- Trigger: keep sold_count in sync when purchases change
create or replace function public.update_landing_page_sold_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.landing_pages
    set sold_count = sold_count + 1
    where id = new.landing_page_id;
  elsif tg_op = 'DELETE' then
    update public.landing_pages
    set sold_count = greatest(0, sold_count - 1)
    where id = old.landing_page_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists purchases_sold_count_trigger on public.purchases;
create trigger purchases_sold_count_trigger
  after insert or delete on public.purchases
  for each row
  execute function public.update_landing_page_sold_count();
