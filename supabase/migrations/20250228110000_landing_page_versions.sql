-- Version history for landing pages
create table public.landing_page_versions (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references public.landing_pages(id) on delete cascade,
  html_content text not null,
  created_at timestamptz default now()
);

create index idx_landing_page_versions_page_id on public.landing_page_versions(landing_page_id);
create index idx_landing_page_versions_created_at on public.landing_page_versions(landing_page_id, created_at desc);

alter table public.landing_page_versions enable row level security;

-- Users can manage versions only for their own landing pages
create policy "Users can manage own landing page versions"
  on public.landing_page_versions for all
  using (
    exists (
      select 1 from public.landing_pages lp
      where lp.id = landing_page_versions.landing_page_id
      and lp.user_id = auth.uid()
    )
  );
