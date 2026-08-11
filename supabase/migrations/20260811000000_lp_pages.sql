-- Standalone editorial pages: "Tentang kami", "Cara kerja", whatever a storefront
-- needs that is not a product and not one of the fixed legal pages.
--
-- Separate from lp_site_settings (key/value blobs for FIXED surfaces the code
-- already renders) because these are rows a person creates and deletes: they have
-- their own URL, their own title, and there is no code that knows their names.
--
-- site_id is NOT NULL: a page belongs to one storefront. Multi-domain means two
-- sites can both have /p/tentang-kami saying different things, so the slug is
-- unique PER SITE rather than globally — the public route resolves the host
-- first, exactly like the catalogue does.
create table if not exists public.lp_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.lp_sites(id) on delete cascade,
  slug text not null,
  title text not null,
  -- Rich text as HTML. Authored by an admin in the panel editor; scripts are
  -- stripped on write (see lib/actions/pages.ts) because this is rendered with
  -- dangerouslySetInnerHTML on a public page.
  content text not null default '',
  -- Drafts are invisible to the public route but editable in the panel, the same
  -- shape as a product's `published`.
  published boolean not null default false,
  -- Position in the footer list. Lower first; ties fall back to title.
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create index if not exists lp_pages_site_published_idx
  on public.lp_pages (site_id, published);

alter table public.lp_pages enable row level security;

-- Public reads published pages only. The panel uses the service-role client with
-- its own requireAdmin() gate, so there is deliberately no permissive write
-- policy here: nothing that reaches this table anonymously may write to it.
create policy "Public can read published pages"
  on public.lp_pages for select
  using (published = true);

comment on table public.lp_pages is
  'Editorial pages per storefront, served at /p/[slug]. Separate from lp_site_settings, which holds fixed surfaces the code already knows about.';
