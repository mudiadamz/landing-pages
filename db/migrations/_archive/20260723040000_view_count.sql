-- Public view counter for product pages (preview + checkout). Incremented via a
-- SECURITY DEFINER RPC so an anonymous visitor can bump the count without an RLS
-- policy that would otherwise let them write arbitrary columns.
alter table lp_landing_pages
  add column if not exists view_count bigint not null default 0;

create or replace function lp_increment_view(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update lp_landing_pages
     set view_count = coalesce(view_count, 0) + 1
   where slug = p_slug;
$$;

grant execute on function lp_increment_view(text) to anon, authenticated;
