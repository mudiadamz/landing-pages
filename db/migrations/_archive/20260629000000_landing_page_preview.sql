-- Preview source for a landing page.
--   'html' (default) → render the inline HTML editor content in the preview iframe (existing behavior)
--   'pdf'            → embed an uploaded PDF (preview_url) instead
--   'link'           → embed an external URL (preview_url) instead
alter table public.lp_landing_pages
  add column if not exists preview_type text not null default 'html',
  add column if not exists preview_url text default null;

-- Guard against unexpected values from the app layer.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lp_landing_pages_preview_type_check'
  ) then
    alter table public.lp_landing_pages
      add constraint lp_landing_pages_preview_type_check
      check (preview_type in ('html', 'pdf', 'link'));
  end if;
end $$;
