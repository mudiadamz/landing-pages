-- Template "blog": tulisan dengan URL persis Blogger/Blogspot.
--
-- Kenapa tabel sendiri, bukan `lp_pages`. `lp_pages` adalah halaman editorial
-- per-situs (About, Kebijakan) — punya slug dan urutan, tidak punya tanggal
-- terbit, label, arsip, atau komentar, dan tidak pernah dimaksudkan punya.
-- Sebuah blog butuh keempatnya, dan yang paling menentukan: **URL-nya bagian
-- dari datanya**.
--
-- URL-nya kenapa DISIMPAN, bukan dihitung. Blogger membangun
-- `/2026/09/judul-tulisan.html` dari bulan tulisan itu PERTAMA terbit, lalu
-- mengunci hasilnya: mengubah tanggal sebuah tulisan lama tidak memindahkan
-- URL-nya, dan slug dipotong ~40 karakter dengan aturan yang tidak pernah
-- didokumentasikan. Menghitung ulang path dari judul + tanggal akan memindahkan
-- sebagian dari 410 tulisan yang diimpor ke alamat yang tidak pernah ada —
-- setiap backlink dan setiap hasil pencarian yang menunjuk ke sana mati diam.
-- Jadi `path` adalah kolom, diisi apa adanya dari ekspor, dan unik per situs.
--
-- Halaman (`kind = 'page'`) memakai `/p/slug.html`, yang **bertabrakan** dengan
-- rute halaman editorial `/p/[slug]` yang sudah ada. Yang membedakan: akhiran
-- `.html`. Rute itu mencoba `lp_pages` dulu, baru tabel ini (lihat
-- app/p/[slug]/page.tsx).

create table public.lp_blog_posts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.lp_sites(id) on delete cascade,
  kind text not null default 'post' check (kind in ('post', 'page')),
  title text not null,
  slug text not null,
  -- Alamat kanonik, apa adanya: '/2026/09/judul.html' atau '/p/judul.html'.
  path text not null,
  content text not null default '',
  -- HTML yang sudah ditelanjangi, untuk snippet dan pencarian. Disimpan supaya
  -- pencarian tidak perlu mem-parse HTML tiap query.
  content_text text not null default '',
  meta_description text,
  author_name text,
  published boolean not null default true,
  -- Bukan created_at: yang menentukan urutan blog dan isi arsip adalah kapan
  -- tulisannya TERBIT, dan untuk arsip impor itu tanggal dari Blogger.
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  thumbnail_url text,
  word_count integer not null default 0,
  -- Identitas di sumbernya, supaya impor ulang MEMPERBARUI dan bukan
  -- menggandakan. NULL untuk tulisan yang lahir di sini; beberapa NULL tidak
  -- saling bentrok di unique index Postgres, jadi keduanya bisa hidup bersama.
  source_id text,
  source_url text,
  -- Kolom pencarian, dihitung database sendiri supaya tidak ada jalur tulis
  -- yang bisa lupa memperbaruinya. Config 'simple': isinya campur Indonesia &
  -- Inggris, dan stemmer Inggris memotong kata Indonesia jadi sampah.
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content_text, ''))
  ) stored,
  unique (site_id, path),
  unique (site_id, source_id)
);

create index lp_blog_posts_feed_idx
  on public.lp_blog_posts (site_id, published_at desc)
  where published;
create index lp_blog_posts_kind_idx on public.lp_blog_posts (site_id, kind);
create index lp_blog_posts_search_idx on public.lp_blog_posts using gin (search);

alter table public.lp_blog_posts enable row level security;
grant all on table public.lp_blog_posts to anon, authenticated, service_role;

-- Publik hanya melihat yang terbit. Draft tidak 403 tapi tidak ada: URL yang
-- belum terbit harus tidak bisa dibedakan dari URL yang tidak pernah dibuat,
-- kalau tidak panel membocorkan apa yang sedang ditulis (aturan yang sama
-- dipakai /p/[slug]).
create policy "Public reads published blog posts" on public.lp_blog_posts
  for select to anon, authenticated using (published);
create policy "Service role manages lp_blog_posts" on public.lp_blog_posts
  for all to service_role using (true) with check (true);

-- Label ------------------------------------------------------------------
--
-- Tanpa kolom `post_count`. Jumlah yang disimpan adalah jumlah yang bisa salah,
-- dan satu-satunya yang menulis tabel ini sekarang adalah importer — sebuah
-- angka yang hanya benar sampai seseorang menghapus satu tulisan lewat SQL
-- lebih buruk daripada satu join atas 65 baris.

create table public.lp_blog_labels (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.lp_sites(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table public.lp_blog_post_labels (
  post_id uuid not null references public.lp_blog_posts(id) on delete cascade,
  label_id uuid not null references public.lp_blog_labels(id) on delete cascade,
  primary key (post_id, label_id)
);
create index lp_blog_post_labels_label_idx on public.lp_blog_post_labels (label_id);

alter table public.lp_blog_labels enable row level security;
alter table public.lp_blog_post_labels enable row level security;
grant all on table public.lp_blog_labels to anon, authenticated, service_role;
grant all on table public.lp_blog_post_labels to anon, authenticated, service_role;

create policy "Public reads blog labels" on public.lp_blog_labels
  for select to anon, authenticated using (true);
create policy "Service role manages lp_blog_labels" on public.lp_blog_labels
  for all to service_role using (true) with check (true);

create policy "Public reads blog post labels" on public.lp_blog_post_labels
  for select to anon, authenticated using (true);
create policy "Service role manages lp_blog_post_labels" on public.lp_blog_post_labels
  for all to service_role using (true) with check (true);

-- Komentar ----------------------------------------------------------------
--
-- Diimpor dan ditampilkan, TIDAK diterima yang baru (keputusan 2026-09-24).
-- Karena itu tidak ada policy insert untuk siapa pun kecuali service role:
-- form komentar yang belum ada tidak boleh punya pintu yang sudah terbuka.
-- Spam dari ekspor ikut disimpan — membuangnya saat impor berarti membuang
-- bukti, dan `status` sudah cukup untuk tidak menampilkannya.

create table public.lp_blog_comments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.lp_sites(id) on delete cascade,
  post_id uuid not null references public.lp_blog_posts(id) on delete cascade,
  parent_id uuid references public.lp_blog_comments(id) on delete cascade,
  author_name text,
  author_url text,
  content text not null default '',
  published_at timestamptz not null default now(),
  status text not null default 'live' check (status in ('live', 'spam', 'pending')),
  source_id text,
  created_at timestamptz not null default now(),
  unique (site_id, source_id)
);
create index lp_blog_comments_post_idx
  on public.lp_blog_comments (post_id, published_at)
  where status = 'live';

alter table public.lp_blog_comments enable row level security;
grant all on table public.lp_blog_comments to anon, authenticated, service_role;

create policy "Public reads live blog comments" on public.lp_blog_comments
  for select to anon, authenticated using (status = 'live');
create policy "Service role manages lp_blog_comments" on public.lp_blog_comments
  for all to service_role using (true) with check (true);

comment on table public.lp_blog_posts is
  'Tulisan & halaman blog per storefront. `path` adalah alamat kanonik apa adanya dari Blogger — disimpan, tidak dihitung ulang.';
comment on column public.lp_blog_posts.source_id is
  'Id di sumbernya (mis. tag:blogger.com,1999:blog-…post-…). Kunci idempoten untuk impor ulang.';
