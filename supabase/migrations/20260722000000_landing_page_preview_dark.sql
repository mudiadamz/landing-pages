-- Optional dark-mode variant for a PDF preview.
--   preview_url       → the light / default PDF (existing column)
--   preview_url_dark  → optional dark-theme PDF; the /lp preview shows it when
--                       the reader is in dark mode. If only one of the two is
--                       set, that file is shown regardless of theme.
alter table public.lp_landing_pages
  add column if not exists preview_url_dark text default null;
