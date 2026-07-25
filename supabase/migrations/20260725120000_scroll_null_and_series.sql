-- 1) scroll_depth: null now means "unknown", which is different from 0.
-- Pages whose content injects asynchronously (the EPUB reader) are not
-- scrollable at mount, and the old code scored that as a full 100%.
alter table lp_page_events alter column scroll_depth drop not null;
alter table lp_page_events alter column scroll_depth drop default;

-- Discard the depths recorded by the buggy measurement: a preview that was
-- "100% scrolled" in under 8 seconds never happened. Dwell is unaffected.
update lp_page_events
set scroll_depth = null
where page_type = 'preview'
  and scroll_depth = 100
  and dwell_ms < 8000;

-- 2) Series continuation. Part 1 pulled 1178 views, Part 2 got 27 — readers who
-- finish a part have nowhere to go. next_product_id renders a "next part" CTA
-- at the end of the reader.
alter table lp_landing_pages
  add column if not exists next_product_id uuid references lp_landing_pages (id) on delete set null;

create index if not exists lp_landing_pages_next_idx on lp_landing_pages (next_product_id);
