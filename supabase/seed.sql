-- Optional seed data. Runs after migrations during `supabase db reset`.
-- Add sample data here if needed.

-- Local test product: an EPUB preview. Points at public/sample-book.epub, which
-- Next serves same-origin at /sample-book.epub (no CORS, so epub.js loads it).
-- Owner is left null (public read policy is `using (true)`); published defaults
-- true. Idempotent so repeated resets don't error.
insert into public.lp_landing_pages (title, slug, preview_type, preview_url, is_free, published)
values (
  'Contoh Buku EPUB',
  'contoh-epub',
  'epub',
  '/sample-book.epub',
  true,
  true
)
on conflict (slug) do update set
  preview_type = excluded.preview_type,
  preview_url  = excluded.preview_url,
  is_free      = excluded.is_free,
  published    = excluded.published;
