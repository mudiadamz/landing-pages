"use server";

import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/db/anon";
import { currentSiteId } from "@/lib/site-resolve";

/**
 * Reading a blog. Everything here is public and cached; nothing here writes.
 *
 * `siteId` is an ARGUMENT on every cached reader, never read from the request
 * inside one — a cached function that calls `headers()` gets its dynamic source
 * refused, catches, and quietly serves one storefront's posts on another's
 * domain (docs/architecture.md, invariant I1). The exported wrappers resolve it
 * once, outside the cache, and pass it down.
 *
 * Writes live in the importer (scripts/import-blogger.mjs), which connects as
 * the service role. There is no panel editor for posts yet, so there is no
 * mutation in this module to gate — and an empty one would be a door propped
 * open for a screen that does not exist.
 */

export type BlogPostSummary = {
  id: string;
  title: string;
  slug: string;
  path: string;
  publishedAt: string;
  excerpt: string;
  thumbnailUrl: string | null;
  wordCount: number;
  labels: string[];
};

export type BlogPost = BlogPostSummary & {
  content: string;
  metaDescription: string | null;
  authorName: string | null;
  updatedAt: string;
  kind: "post" | "page";
};

export type BlogComment = {
  id: string;
  parentId: string | null;
  authorName: string | null;
  authorUrl: string | null;
  content: string;
  publishedAt: string;
};

export type BlogListing = {
  items: BlogPostSummary[];
  total: number;
  page: number;
  pageCount: number;
};

export type BlogLabel = { name: string; slug: string; count: number };
export type BlogArchiveMonth = { year: string; month: string; count: number };

/**
 * NOT exported. A `"use server"` module may only export async functions
 * (docs/architecture.md, invariant I5) — and the failure is silent in the worst
 * way: exporting one const makes the compiler report "the module has no exports
 * at all", so every route importing a reader fails to build with an error that
 * names the reader rather than the const.
 */
const BLOG_PAGE_SIZE = 10;

/** The columns a card needs. Deliberately not `content` — 410 of those is a MB. */
const SUMMARY_COLUMNS =
  "id, title, slug, path, published_at, meta_description, content_text, thumbnail_url, word_count";

type SummaryRow = {
  id: string;
  title: string;
  slug: string;
  path: string;
  published_at: string;
  meta_description: string | null;
  content_text: string | null;
  thumbnail_url: string | null;
  word_count: number;
};

/**
 * The teaser under a title.
 *
 * Prefers the author's own meta description — they wrote it to be read alone —
 * and falls back to the stripped body, cut on a word boundary so the card never
 * ends mid-word with an ellipsis stuck to half a syllable.
 */
function excerptOf(row: SummaryRow, length = 180): string {
  const explicit = row.meta_description?.trim();
  if (explicit) return explicit;
  const text = (row.content_text ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > length * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function toSummary(row: SummaryRow, labels: string[] = []): BlogPostSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    path: row.path,
    publishedAt: row.published_at,
    excerpt: excerptOf(row),
    thumbnailUrl: row.thumbnail_url,
    wordCount: row.word_count ?? 0,
    labels,
  };
}

/**
 * Labels for a page of posts, in one round trip rather than one per card.
 *
 * Done as a second query instead of an embed because the join table sits
 * between two tables and the embed syntax for that needs a constraint hint that
 * is easy to get wrong and silent when it is — the same reason
 * getPurchasesForUser looks up bundle titles separately.
 */
async function labelsFor(
  db: ReturnType<typeof createAnonClient>,
  postIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (postIds.length === 0) return out;
  const { data } = await db
    .from("lp_blog_post_labels")
    .select("post_id, lp_blog_labels(name)")
    .in("post_id", postIds);
  type Row = { post_id: string; lp_blog_labels: { name: string } | { name: string }[] | null };
  for (const row of (data ?? []) as Row[]) {
    const joined = Array.isArray(row.lp_blog_labels) ? row.lp_blog_labels[0] : row.lp_blog_labels;
    if (!joined?.name) continue;
    out.set(row.post_id, [...(out.get(row.post_id) ?? []), joined.name]);
  }
  return out;
}

async function listing(
  siteId: string,
  page: number,
  build: (
    q: ReturnType<ReturnType<typeof createAnonClient>["from"]>,
  ) => ReturnType<ReturnType<typeof createAnonClient>["from"]>,
): Promise<BlogListing> {
  const db = createAnonClient();
  const safePage = Math.max(1, Math.floor(page) || 1);
  const from = (safePage - 1) * BLOG_PAGE_SIZE;

  let query = db
    .from("lp_blog_posts")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .eq("site_id", siteId)
    .eq("kind", "post")
    .eq("published", true);
  query = build(query) as typeof query;

  const { data, count, error } = await query
    .order("published_at", { ascending: false })
    .range(from, from + BLOG_PAGE_SIZE - 1);

  // Throw rather than return empty: an empty result would be CACHED as if the
  // blog had no posts (docs/architecture.md §5).
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as SummaryRow[];
  const byPost = await labelsFor(db, rows.map((r) => r.id));
  const total = count ?? rows.length;
  return {
    items: rows.map((r) => toSummary(r, byPost.get(r.id) ?? [])),
    total,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE)),
  };
}

const readFeed = unstable_cache(
  (siteId: string, page: number) => listing(siteId, page, (q) => q),
  ["blog-feed"],
  { revalidate: 120, tags: ["blog"] },
);

const readByLabel = unstable_cache(
  async (siteId: string, labelSlug: string, page: number): Promise<BlogListing> => {
    const db = createAnonClient();
    const { data: label } = await db
      .from("lp_blog_labels")
      .select("id")
      .eq("site_id", siteId)
      .eq("slug", labelSlug)
      .maybeSingle();
    if (!label) return { items: [], total: 0, page: 1, pageCount: 1 };

    const { data: links } = await db
      .from("lp_blog_post_labels")
      .select("post_id")
      .eq("label_id", (label as { id: string }).id);
    const ids = ((links ?? []) as { post_id: string }[]).map((l) => l.post_id);
    if (ids.length === 0) return { items: [], total: 0, page: 1, pageCount: 1 };

    return listing(siteId, page, (q) => q.in("id", ids));
  },
  ["blog-label"],
  { revalidate: 120, tags: ["blog"] },
);

const readArchive = unstable_cache(
  (siteId: string, year: string, month: string | null, page: number) =>
    listing(siteId, page, (q) =>
      // The archive is asked of the stored PATH, not of published_at. Blogger
      // froze a post's month into its URL at first publication, so a re-dated
      // post stays in the archive its address says it is in — anything else
      // would list a post at /2020/03/ that answers on /2019/11/.
      q.like("path", month ? `/${year}/${month}/%` : `/${year}/%`),
    ),
  ["blog-archive"],
  { revalidate: 300, tags: ["blog"] },
);

const readSearch = unstable_cache(
  async (siteId: string, query: string, page: number): Promise<BlogListing> => {
    const term = query.trim();
    if (!term) return { items: [], total: 0, page: 1, pageCount: 1 };
    // `ilike` on the stripped text rather than the tsvector: PostgREST's
    // full-text operators need the same config the generated column was built
    // with, and a mismatch there returns nothing at all rather than an error.
    // 410 posts is small enough that the honest, obvious query wins.
    const escaped = term.replace(/[%_\\,()]/g, " ").trim();
    if (!escaped) return { items: [], total: 0, page: 1, pageCount: 1 };
    return listing(siteId, page, (q) =>
      q.or(`title.ilike.%${escaped}%,content_text.ilike.%${escaped}%`),
    );
  },
  ["blog-search"],
  { revalidate: 60, tags: ["blog"] },
);

const readPostByPath = unstable_cache(
  async (siteId: string, path: string): Promise<BlogPost | null> => {
    const db = createAnonClient();
    const { data } = await db
      .from("lp_blog_posts")
      .select(`${SUMMARY_COLUMNS}, content, author_name, updated_at, kind`)
      .eq("site_id", siteId)
      .eq("path", path)
      .eq("published", true)
      .maybeSingle();
    if (!data) return null;
    const row = data as SummaryRow & {
      content: string;
      author_name: string | null;
      updated_at: string;
      kind: "post" | "page";
    };
    const byPost = await labelsFor(db, [row.id]);
    return {
      ...toSummary(row, byPost.get(row.id) ?? []),
      content: row.content,
      metaDescription: row.meta_description,
      authorName: row.author_name,
      updatedAt: row.updated_at,
      kind: row.kind,
    };
  },
  ["blog-post"],
  { revalidate: 300, tags: ["blog"] },
);

const readLabels = unstable_cache(
  async (siteId: string): Promise<BlogLabel[]> => {
    const db = createAnonClient();
    const { data: labels } = await db
      .from("lp_blog_labels")
      .select("id, name, slug")
      .eq("site_id", siteId);
    const rows = (labels ?? []) as { id: string; name: string; slug: string }[];
    if (rows.length === 0) return [];

    const { data: links } = await db
      .from("lp_blog_post_labels")
      .select("label_id")
      .in("label_id", rows.map((r) => r.id));
    const counts = new Map<string, number>();
    for (const l of (links ?? []) as { label_id: string }[]) {
      counts.set(l.label_id, (counts.get(l.label_id) ?? 0) + 1);
    }
    return rows
      .map((r) => ({ name: r.name, slug: r.slug, count: counts.get(r.id) ?? 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  },
  ["blog-labels"],
  { revalidate: 300, tags: ["blog"] },
);

const readArchiveMonths = unstable_cache(
  async (siteId: string): Promise<BlogArchiveMonth[]> => {
    const db = createAnonClient();
    // Only the path is read: it is what the archive routes match on, and
    // grouping in JS over 410 short strings is cheaper than a round trip for a
    // GROUP BY this app has no RPC for.
    const { data } = await db
      .from("lp_blog_posts")
      .select("path")
      .eq("site_id", siteId)
      .eq("kind", "post")
      .eq("published", true);
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as { path: string }[]) {
      const m = row.path.match(/^\/(\d{4})\/(\d{2})\//);
      if (!m) continue;
      const key = `${m[1]}-${m[2]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => {
        const [year, month] = key.split("-");
        return { year, month, count };
      })
      .sort((a, b) => (a.year === b.year ? b.month.localeCompare(a.month) : b.year.localeCompare(a.year)));
  },
  ["blog-archive-months"],
  { revalidate: 300, tags: ["blog"] },
);

const readComments = unstable_cache(
  async (siteId: string, postId: string): Promise<BlogComment[]> => {
    const db = createAnonClient();
    const { data } = await db
      .from("lp_blog_comments")
      .select("id, parent_id, author_name, author_url, content, published_at")
      .eq("site_id", siteId)
      .eq("post_id", postId)
      .eq("status", "live")
      .order("published_at", { ascending: true });
    type Row = {
      id: string;
      parent_id: string | null;
      author_name: string | null;
      author_url: string | null;
      content: string;
      published_at: string;
    };
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      parentId: r.parent_id,
      authorName: r.author_name,
      authorUrl: r.author_url,
      content: r.content,
      publishedAt: r.published_at,
    }));
  },
  ["blog-comments"],
  { revalidate: 300, tags: ["blog"] },
);

/* ---- Public wrappers: resolve the site OUTSIDE the cache, then pass it in --- */

export async function getBlogFeed(page = 1, siteId?: string): Promise<BlogListing> {
  return readFeed(siteId ?? (await currentSiteId()), page);
}

export async function getBlogPostByPath(path: string, siteId?: string): Promise<BlogPost | null> {
  return readPostByPath(siteId ?? (await currentSiteId()), path);
}

export async function getBlogByLabel(labelSlug: string, page = 1): Promise<BlogListing> {
  return readByLabel(await currentSiteId(), labelSlug, page);
}

export async function getBlogArchive(
  year: string,
  month: string | null,
  page = 1,
): Promise<BlogListing> {
  return readArchive(await currentSiteId(), year, month, page);
}

export async function searchBlog(query: string, page = 1): Promise<BlogListing> {
  return readSearch(await currentSiteId(), query, page);
}

export async function getBlogLabels(siteId?: string): Promise<BlogLabel[]> {
  return readLabels(siteId ?? (await currentSiteId()));
}

export async function getBlogArchiveMonths(siteId?: string): Promise<BlogArchiveMonth[]> {
  return readArchiveMonths(siteId ?? (await currentSiteId()));
}

export async function getBlogComments(postId: string): Promise<BlogComment[]> {
  return readComments(await currentSiteId(), postId);
}

/**
 * The blog's own pages (`/p/*.html`), for the footer nav.
 *
 * Kind 'page' rather than 'post': these are the About / privacy-policy pages a
 * Blogger site carries, which never appear in the feed and never belong to an
 * archive month.
 */
const readPages = unstable_cache(
  async (siteId: string): Promise<{ title: string; path: string }[]> => {
    const db = createAnonClient();
    const { data } = await db
      .from("lp_blog_posts")
      .select("title, path")
      .eq("site_id", siteId)
      .eq("kind", "page")
      .eq("published", true)
      .order("title", { ascending: true });
    return (data ?? []) as { title: string; path: string }[];
  },
  ["blog-pages"],
  { revalidate: 300, tags: ["blog"] },
);

export async function getBlogPages(siteId?: string): Promise<{ title: string; path: string }[]> {
  return readPages(siteId ?? (await currentSiteId()));
}

/** Every published path, for the sitemap and the feed. */
export async function getBlogPaths(siteId?: string): Promise<{ path: string; updatedAt: string }[]> {
  const db = createAnonClient();
  const { data } = await db
    .from("lp_blog_posts")
    .select("path, updated_at")
    .eq("site_id", siteId ?? (await currentSiteId()))
    .eq("published", true)
    .order("published_at", { ascending: false });
  return ((data ?? []) as { path: string; updated_at: string }[]).map((r) => ({
    path: r.path,
    updatedAt: r.updated_at,
  }));
}
