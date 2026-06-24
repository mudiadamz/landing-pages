-- Two-level categories: a category may belong to a parent category.
-- parent_id NULL  => top-level (parent) category
-- parent_id set   => sub-category of that parent
-- Self-referential FK; on parent delete, children become top-level (set null).
alter table public.lp_landing_page_categories
  add column if not exists parent_id uuid
  references public.lp_landing_page_categories(id) on delete set null;

create index if not exists idx_lp_categories_parent
  on public.lp_landing_page_categories(parent_id);
