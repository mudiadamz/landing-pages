-- Preview source 'deliverable': the preview reuses the product's own PDF/EPUB
-- deliverable (story_pdf_url / story_epub_url) instead of a separate preview
-- file — the whole file is then readable in the free preview. Widen the check.
alter table public.lp_landing_pages
  drop constraint if exists lp_landing_pages_preview_type_check;
alter table public.lp_landing_pages
  add constraint lp_landing_pages_preview_type_check
  check (preview_type in ('html', 'pdf', 'link', 'epub', 'deliverable'));
