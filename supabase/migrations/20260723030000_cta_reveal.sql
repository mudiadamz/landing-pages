-- When the sticky "beli sekarang" CTA appears as the visitor scrolls through the
-- preview: "start" | "middle" (default) | "near" | "end". Stored as a keyword;
-- the reader maps it to a scroll-progress fraction. NULL = middle.
alter table lp_landing_pages
  add column if not exists cta_reveal text default null;
