-- Optional dark-mode variant for the PDF deliverable (the "story" a buyer reads
-- in their purchases list). story_pdf_url stays the primary/light file (it gates
-- the reader button); story_pdf_url_dark, when set, is shown to readers in dark
-- mode instead of colour-inverting the light file.
alter table public.lp_landing_pages
  add column if not exists story_pdf_url_dark text default null;
