"use server";

import { getPlanLimits } from "@/lib/actions/site-settings";
import { t } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { effectivePlan, resolvePlanLimits, withinLimit, PLANS } from "@/lib/plans";
import { revalidatePath, updateTag, unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/db/anon";
import { createClient } from "@/lib/db/server";
import { isValidSlug } from "@/lib/slug";
import { sanitizeRichText } from "@/lib/html-sanitize";
import { currentSite, editingSite } from "@/lib/site-resolve";
import { panelScope } from "@/lib/site-scope";

export type PreviewType = "html" | "pdf" | "link" | "epub" | "deliverable" | "excerpt";


export type LandingPageCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  /** NULL = top-level (parent) category; set = sub-category of that parent. */
  parent_id?: string | null;
};

export type LandingPageRow = {
  id: string;
  title: string;
  slug: string;
  html_content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  price?: number | null;
  price_discount?: number | null;
  is_free?: boolean;
  purchase_link?: string | null;
  purchase_type?: "external" | "internal";
  featured?: boolean;
  thumbnail_url?: string | null;
  thumbnail_landscape_url?: string | null;
  zip_url?: string | null;
  sold_count?: number;
  rating?: number | null;
  category_id?: string | null;
  long_description?: string | null;
  preview_type?: PreviewType;
  preview_url?: string | null;
  preview_url_dark?: string | null;
  /** Optional overrides for the preview buy-now card (empty → derived default). */
  cta_label?: string | null;
  cta_note?: string | null;
};

export type LandingPagePublic = {
  id: string;
  title: string;
  slug: string;
  html_content?: string;
  price?: number | null;
  price_discount?: number | null;
  is_free?: boolean;
  purchase_link?: string | null;
  purchase_type?: "external" | "internal";
  thumbnail_url?: string | null;
  thumbnail_landscape_url?: string | null;
  sold_count?: number;
  rating?: number | null;
  category?: LandingPageCategory | null;
  long_description?: string | null;
  /** Pinned products sort to the front of listings. */
  featured?: boolean;
  /** Scheduled release instant (ISO); in the future = "upcoming". */
  available_at?: string | null;
};

export type LandingPageCheckout = {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  price_discount: number | null;
  is_free: boolean;
  purchase_link: string | null;
  purchase_type?: "external" | "internal";
  thumbnail_url: string | null;
  thumbnail_landscape_url?: string | null;
  zip_url: string | null;
  story_pdf_url?: string | null;
  story_epub_url?: string | null;
  long_description?: string | null;
  category_id?: string | null;
  sold_count?: number;
  rating?: number | null;
  view_count?: number;
  like_count?: number;
  /** Preview-button text. Free text; see lib/preview-label. */
  preview_label?: string | null;
  cta_label?: string | null;
  cta_note?: string | null;
  /** Buy-button action: "checkout" (default) | "link" | "calendar". */
  cta_action?: "checkout" | "link" | "calendar" | null;
  event_title?: string | null;
  /** Floating local datetime string, e.g. "2026-08-01T14:00". */
  event_start?: string | null;
  event_end?: string | null;
  event_location?: string | null;
  event_description?: string | null;
  /** Scheduled release instant (ISO); before it, non-owners see a countdown. */
  available_at?: string | null;
  /** Product owner — used to let the owner bypass the upcoming lock (preview). */
  user_id?: string;
};

/**
 * A storefront names ROOT categories; the products it carries are those plus everything
 * in their sub-categories. Same expansion the public catalog does — extracted so the
 * panel's product list can scope itself the same way, instead of a second implementation
 * that drifts.
 *
 * An empty input means "the whole catalog" (the canonical site) and returns null, which
 * callers read as "no filter". It must never be read as "show nothing".
 */
export async function expandNicheCategoryIds(
  siteCategoryIds: string[],
): Promise<string[] | null> {
  if (!siteCategoryIds || siteCategoryIds.length === 0) return null;
  const cats = await getCategories();
  const allowed = new Set<string>();
  for (const rootId of siteCategoryIds) {
    allowed.add(rootId);
    for (const c of cats) if (c.parent_id === rootId) allowed.add(c.id);
  }
  return [...allowed];
}

export async function getLandingPagesForUser() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];

  // Scoped to the storefront the panel is managing. Products belong to CATEGORIES, not
  // to sites, so the filter is the site's niche expanded to its sub-categories — exactly
  // what the public catalog does. A product with no category therefore appears only under
  // a site that carries the whole catalog, which is also true of the storefront itself.
  const { site } = await panelScope();
  const allowedCategories = await expandNicheCategoryIds(site.category_ids ?? []);

  let query = db
    .from("lp_landing_pages")
    .select("id, title, slug, created_at, updated_at, price, price_discount, is_free, purchase_link, purchase_type, featured, published, category_id, zip_url, view_count")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (allowedCategories) query = query.in("category_id", allowedCategories);

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

export async function getLandingPageById(id: string) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const { data, error } = await db
    .from("lp_landing_pages")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data as LandingPageRow;
}

export async function getLandingPageBySlug(slug: string) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const site = await currentSite();
  let q = db
    .from("lp_landing_pages")
    .select("id, title, slug, html_content, preview_type, preview_url, preview_url_dark, preview_cut_percent, preview_purged_at, story_pdf_url, story_pdf_url_dark, story_epub_url, like_count, related_product_ids, next_product_id, available_at, thumbnail_url, published, user_id")
    .eq("slug", slug);
  // A slug resolves only within this storefront's business (Fase 2).
  if (site.business_id) q = q.eq("business_id", site.business_id);
  const { data, error } = await q.single();

  if (error || !data) return null;
  // Hidden pages 404 for everyone except their owner (so the admin can preview).
  if (data.published === false && data.user_id !== user?.id) return null;
  return data as {
    id: string;
    title: string;
    slug: string;
    html_content: string;
    preview_type?: PreviewType | null;
    preview_url?: string | null;
    preview_url_dark?: string | null;
    preview_cut_percent?: number | null;
    preview_purged_at?: string | null;
    story_pdf_url?: string | null;
    story_pdf_url_dark?: string | null;
    story_epub_url?: string | null;
    like_count?: number;
    related_product_ids?: string[] | null;
    next_product_id?: string | null;
    available_at?: string | null;
    thumbnail_url?: string | null;
  thumbnail_landscape_url?: string | null;
    user_id?: string;
  };
}

/**
 * A published bundle that contains this product, for the end-of-preview upsell —
 * someone finishing a free part is the best moment to offer the complete set.
 */
export async function getBundleContaining(productId: string) {
  const db = await createClient();
  const { data } = await db
    .from("lp_landing_pages")
    .select("id, title, slug, thumbnail_url, thumbnail_landscape_url, price, price_discount, is_free, bundle_product_ids, bundle_note, published")
    .contains("bundle_product_ids", [productId])
    .eq("published", true)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return data as {
    id: string;
    title: string;
    slug: string;
    thumbnail_url?: string | null;
    thumbnail_landscape_url?: string | null;
    price?: number | null;
    price_discount?: number | null;
    is_free?: boolean | null;
    bundle_product_ids?: string[] | null;
    bundle_note?: string | null;
  };
}

/**
 * The next instalment in a series, for the "continue reading" CTA at the end of
 * a preview. Readers who finish a part otherwise have nowhere to go.
 */
export async function getNextInSeries(nextProductId: string) {
  const db = await createClient();
  const { data } = await db
    .from("lp_landing_pages")
    .select("id, title, slug, thumbnail_url, thumbnail_landscape_url, price, price_discount, is_free, published")
    .eq("id", nextProductId)
    .maybeSingle();
  if (!data || data.published === false) return null;
  return data as {
    id: string;
    title: string;
    slug: string;
    thumbnail_url?: string | null;
  thumbnail_landscape_url?: string | null;
    price?: number | null;
    price_discount?: number | null;
    is_free?: boolean | null;
  };
}

export async function createLandingPage(
  title: string,
  slug: string,
  html_content: string,
  category_id?: string | null,
) {
  const normalizedSlug = slug.toLowerCase().trim();
  if (!isValidSlug(normalizedSlug)) {
    throw new Error("Invalid slug: use only lowercase letters, numbers, and hyphens.");
  }

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  /**
   * The seller's plan caps how many products they may own.
   *
   * Checked on CREATE only: an account that drops to a smaller plan keeps what it
   * already published — taking a live product off sale because a subscription
   * lapsed would punish the buyer, not the seller.
   */
  const [{ data: profile }, { count }, overrides] = await Promise.all([
    db.from("lp_profiles").select("plan, plan_expires_at").eq("id", user.id).maybeSingle(),
    db.from("lp_landing_pages").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    getPlanLimits(),
  ]);
  const plan = effectivePlan(profile?.plan, profile?.plan_expires_at ?? null);
  const { maxProducts } = resolvePlanLimits(plan, overrides);
  if (!withinLimit(count ?? 0, maxProducts)) {
    throw new Error(
      t("plan.productLimit", { plan: PLANS[plan].label, limit: maxProducts ?? 0 }, await requestLocale()),
    );
  }

  const { data, error } = await db
    .from("lp_landing_pages")
    .insert({
      title,
      slug: normalizedSlug,
      html_content,
      user_id: user.id,
      // The product belongs to the panel's business (Fase 2). Set explicitly
      // rather than via a current_business() default, because a server action
      // may not have resolved the site — the explicit value is race-proof.
      business_id: (await editingSite()).business_id,
      category_id: category_id?.trim() || null,
      // Step 1 only creates a draft — the product stays hidden from public
      // listings until the seller explicitly publishes it (from the panel).
      published: false,
    })
    .select("id")
    .single();

  if (error) throw error;
  revalidatePath("/panel");
  return data.id;
}

export async function updateLandingPageHtml(id: string, html_content: string) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await db
    .from("lp_landing_pages")
    .update({ html_content })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath("/panel");
  revalidatePath(`/panel/product/${id}/edit`);
}

/**
 * Update editable page settings: title and the preview source. The preview
 * source controls what /preview/[slug] embeds — inline HTML (default), an uploaded
 * PDF, or an external link.
 */
export async function updateLandingPageSettings(
  id: string,
  opts: {
    title?: string;
    preview_type?: PreviewType;
    preview_url?: string | null;
    preview_url_dark?: string | null;
    preview_cut_percent?: number;
  },
  slug?: string,
) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const update: Record<string, unknown> = {};
  if (opts.title !== undefined) {
    const title = opts.title.trim();
    if (!title) throw new Error("Title cannot be empty.");
    update.title = title;
  }
  if (opts.preview_type !== undefined) update.preview_type = opts.preview_type;
  if (opts.preview_url !== undefined) update.preview_url = opts.preview_url?.trim() || null;
  if (opts.preview_url_dark !== undefined)
    update.preview_url_dark = opts.preview_url_dark?.trim() || null;
  // Clamped to the DB's own CHECK range so a hand-edited form field fails here
  // with a usable message rather than as a constraint violation.
  if (opts.preview_cut_percent !== undefined) {
    update.preview_cut_percent = Math.max(5, Math.min(95, Math.round(opts.preview_cut_percent)));
  }

  // A PDF preview needs at least one file (light or dark); a link needs its URL.
  if (opts.preview_type === "pdf" && opts.preview_url !== undefined) {
    if (!update.preview_url && !update.preview_url_dark) {
      throw new Error("Preview PDF membutuhkan minimal satu file (terang atau gelap).");
    }
  }
  if (opts.preview_type === "link" && opts.preview_url !== undefined && !update.preview_url) {
    throw new Error("Preview link membutuhkan URL.");
  }

  const { error } = await db
    .from("lp_landing_pages")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;

  updateTag("homepage-pages");
  revalidatePath("/panel");
  revalidatePath(`/panel/product/${id}/edit`);
  if (slug) {
    revalidatePath(`/preview/${slug}`);
    revalidatePath(`/checkout/${slug}`);
  }
  revalidatePath("/");
}

const getCachedCategories = unstable_cache(
  async (businessId: string | null): Promise<LandingPageCategory[]> => {
    const db = createAnonClient();
    let query = db
      .from("lp_landing_page_categories")
      .select("id, name, slug, icon, parent_id")
      .order("sort_order", { ascending: true });
    // Business isolation (null = unconfigured/fallback: no filter).
    if (businessId) query = query.eq("business_id", businessId);
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as LandingPageCategory[];
  },
  ["categories"],
  { revalidate: 60, tags: ["categories"] },
);

/**
 * Categories for a storefront/panel. `businessId` (from currentSite/editingSite)
 * is part of the cache key + filter so each business sees only its own — passed
 * in, because a cached function cannot read the request (docs/plans/multi-business-saas.md).
 * Omitted = no filter (single-business / fallback), so existing behaviour holds.
 */
export async function getCategories(businessId?: string | null): Promise<LandingPageCategory[]> {
  return getCachedCategories(businessId ?? null);
}

export type HomepageSort = "newest" | "popular";

export async function getLandingPagesForHomepage(
  categorySlug?: string | null,
  sort: HomepageSort = "newest",
) {
  const slug = categorySlug?.trim() || "";
  // The storefront's own niche. Passed as an ARGUMENT, not read inside the cache:
  // unstable_cache refuses headers(), and the argument is what makes the cache key
  // differ per domain — without it one storefront would serve another's catalog.
  const site = await currentSite();
  return getCachedHomepagePages(slug, sort, site.category_ids ?? [], site.business_id);
}

/* -------------------------------------------------------------------------- */
/*  Paged + searchable listing                                                */
/* -------------------------------------------------------------------------- */

/**
 * Rows per page in the storefront listing.
 *
 * NOT exported: this module is "use server", where every export is compiled into
 * a server action and only async functions are allowed (I5). Nothing outside
 * needs the number anyway — callers get `pageCount` in the result.
 */
const HOMEPAGE_PAGE_SIZE = 12;

export type HomepageListing = {
  items: LandingPagePublic[];
  /** Total matching rows, for the pager and the "N hasil" line. */
  total: number;
  pageCount: number;
  /** 1-based, already clamped to the available range. */
  page: number;
};

/**
 * A search term safe to drop into a PostgREST `or(...)` filter.
 *
 * That syntax is comma-separated and parenthesised, so a raw comma or bracket
 * from a visitor rewrites the filter rather than being matched by it, and `%`
 * or `_` would turn their query into a wildcard. Everything else survives, and
 * the length cap keeps a pathological string out of the query planner.
 */
function sanitizeQuery(raw: string): string {
  return raw.replace(/[,()%_*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

type ListingArgs = {
  categoryIds: string[] | null;
  sort: HomepageSort;
  q: string;
  page: number;
  /**
   * Which business's catalog to show (docs/plans/multi-business-saas.md, Fase 2).
   * Resolved from the storefront's site outside any cache and passed in — like
   * categoryIds — so it is part of the cache key AND the query filter, which is
   * what makes isolation cache-safe (the ambient-GUC approach was not). null =
   * unconfigured/fallback: no filter, so a single-business deployment is unchanged.
   */
  businessId?: string | null;
};

/**
 * One query, used by both the cached and uncached paths.
 *
 * `count: "exact"` rather than counting a second time: the pager needs a total
 * and PostgREST returns it in the same round trip.
 */
async function queryListing({ categoryIds, sort, q, page, businessId }: ListingArgs): Promise<HomepageListing> {
  const db = createAnonClient();
  const from = (page - 1) * HOMEPAGE_PAGE_SIZE;

  let query = db
    .from("lp_landing_pages")
    .select(
      "id, title, slug, price, price_discount, is_free, purchase_link, purchase_type, thumbnail_url, thumbnail_landscape_url, sold_count, rating, long_description, featured, available_at, landing_page_categories:lp_landing_page_categories(id, name, slug, icon, parent_id)",
      { count: "exact" },
    )
    .eq("published", true)
    .order("featured", { ascending: false });

  // Business isolation: only this storefront's business. null = unconfigured.
  if (businessId) query = query.eq("business_id", businessId);

  query =
    sort === "popular"
      ? query.order("sold_count", { ascending: false, nullsFirst: false })
      : query.order("created_at", { ascending: false });

  if (categoryIds) query = query.in("category_id", categoryIds);
  if (q) query = query.or(`title.ilike.%${q}%,long_description.ilike.%${q}%`);

  const { data, error, count } = await query.range(from, from + HOMEPAGE_PAGE_SIZE - 1);
  if (error) {
    console.error("queryListing error:", error);
    // Throw rather than return empty: an empty result would be CACHED as if the
    // storefront had no products (see docs/architecture.md §5).
    throw new Error(error.message);
  }

  type Row = Omit<LandingPagePublic, "category"> & {
    landing_page_categories: LandingPageCategory | null;
  };
  const items = ((data ?? []) as unknown as Row[]).map(({ landing_page_categories, ...p }) => ({
    ...p,
    category: landing_page_categories ?? null,
  })) as LandingPagePublic[];

  const total = count ?? items.length;
  return {
    items,
    total,
    pageCount: Math.max(1, Math.ceil(total / HOMEPAGE_PAGE_SIZE)),
    page,
  };
}

/**
 * Cached only when there is no search term.
 *
 * A query string is visitor-supplied and unbounded, so caching per term would
 * mint a cache entry for every thing anyone ever typed. Browsing (page + sort +
 * category) is a small, known key space and is cached as before.
 */
const getCachedListing = unstable_cache(
  async (categoryIds: string[] | null, sort: HomepageSort, page: number, businessId: string | null) =>
    queryListing({ categoryIds, sort, q: "", page, businessId }),
  ["homepage-listing"],
  { revalidate: 60, tags: ["categories", "homepage-pages"] },
);

export async function getHomepageListing(opts: {
  categorySlug?: string | null;
  /** Several at once, for the homepage's toggle chips. Union, not intersection. */
  categorySlugs?: string[];
  sort?: HomepageSort;
  page?: number;
  q?: string;
}): Promise<HomepageListing> {
  const sort = opts.sort ?? "newest";
  const q = sanitizeQuery(opts.q ?? "");
  const page = Math.max(1, Math.floor(opts.page ?? 1));

  // Resolved OUTSIDE the cache, like the listing above: the site comes from the
  // request, and a cached function cannot read it (I1).
  const site = await currentSite();
  const slugs = [
    ...(opts.categorySlug?.trim() ? [opts.categorySlug.trim()] : []),
    ...(opts.categorySlugs ?? []).map((s) => s.trim()).filter(Boolean),
  ];
  const categoryIds = await resolveListingCategoryIds(slugs, site.category_ids ?? []);
  if (categoryIds === "none") {
    return { items: [], total: 0, pageCount: 1, page: 1 };
  }

  return q
    ? queryListing({ categoryIds, sort, q, page, businessId: site.business_id })
    : // categoryIds + businessId are part of the key: without them, two different
      // chip selections — or two businesses — would share one cached page.
      getCachedListing(categoryIds, sort, page, site.business_id);
}

/**
 * The category ids a listing may include: the browsed category expanded to its
 * children, intersected with the storefront's own niche.
 *
 * "none" means "this storefront carries nothing matching" — distinct from null,
 * which means "no filter, whole catalogue".
 */
async function resolveListingCategoryIds(
  slugs: string[],
  siteCategoryIds: string[],
): Promise<string[] | null | "none"> {
  let categoryIds: string[] | null = null;

  if (slugs.length > 0) {
    const cats = await getCategories();
    const picked = new Set<string>();
    for (const slug of slugs) {
      const target = cats.find((c) => c.slug === slug);
      // An unknown slug is ignored rather than emptying the page: chips are
      // toggled from a URL anyone can edit, and one stale name should not make
      // the whole storefront look empty.
      if (!target) continue;
      picked.add(target.id);
      for (const c of cats) if (c.parent_id === target.id) picked.add(c.id);
    }
    if (picked.size === 0) return "none";
    categoryIds = [...picked];
  }

  if (siteCategoryIds.length > 0) {
    const cats = await getCategories();
    const allowed = new Set<string>();
    for (const rootId of siteCategoryIds) {
      allowed.add(rootId);
      for (const c of cats) if (c.parent_id === rootId) allowed.add(c.id);
    }
    categoryIds = categoryIds === null ? [...allowed] : categoryIds.filter((id) => allowed.has(id));
    if (categoryIds.length === 0) return "none";
  }

  return categoryIds;
}

const getCachedHomepagePages = unstable_cache(
  async (
    slug: string,
    sort: HomepageSort,
    siteCategoryIds: string[],
    businessId: string | null,
  ): Promise<LandingPagePublic[]> => {
    const db = createAnonClient();

    // Resolve the requested category slug to the set of category ids to include.
    // For a PARENT category, aggregate its own pages + all of its sub-categories'
    // pages. For a leaf/sub category, just that one. Unknown slug => no results.
    let categoryIds: string[] | null = null;
    if (slug) {
      const cats = await getCategories();
      const target = cats.find((c) => c.slug === slug);
      if (!target) return [];
      const childIds = cats
        .filter((c) => c.parent_id === target.id)
        .map((c) => c.id);
      categoryIds = [target.id, ...childIds];
    }

    // Narrow to the storefront's niche. The site names ROOT categories, so expand
    // each to its children the same way a browsed parent category expands.
    // An empty list means "whole catalog" — that is the canonical site, and it must
    // not be read as "show nothing".
    if (siteCategoryIds.length > 0) {
      const cats = await getCategories();
      const allowed = new Set<string>();
      for (const rootId of siteCategoryIds) {
        allowed.add(rootId);
        for (const c of cats) if (c.parent_id === rootId) allowed.add(c.id);
      }
      categoryIds =
        categoryIds === null
          ? [...allowed]
          : categoryIds.filter((id) => allowed.has(id));
      // Browsing a category this storefront doesn't carry yields nothing rather
      // than leaking a product from another niche.
      if (categoryIds.length === 0) return [];
    }

    let query = db
      .from("lp_landing_pages")
      .select(
        "id, title, slug, price, price_discount, is_free, purchase_link, purchase_type, thumbnail_url, thumbnail_landscape_url, sold_count, rating, long_description, featured, available_at, landing_page_categories:lp_landing_page_categories(id, name, slug, icon, parent_id)",
      )
      // Pinned (featured) products always first, then the chosen sort:
      // "popular" = most sold, "newest" = most recently created.
      .eq("published", true)
      .order("featured", { ascending: false });

    // Business isolation (null = unconfigured/fallback: no filter).
    if (businessId) query = query.eq("business_id", businessId);

    query =
      sort === "popular"
        ? query.order("sold_count", { ascending: false, nullsFirst: false })
        : query.order("created_at", { ascending: false });

    query = query.limit(24);

    if (categoryIds) {
      query = query.in("category_id", categoryIds);
    }

    const { data, error } = await query;

    if (error) return [];
    type Row = Omit<LandingPagePublic, "category"> & { landing_page_categories: LandingPageCategory | null };
    const list = (data ?? []) as unknown as Row[];
    return list.map(({ landing_page_categories, ...p }) => ({
      ...p,
      category: landing_page_categories ?? null,
    })) as LandingPagePublic[];
  },
  ["homepage-pages"],
  { revalidate: 60, tags: ["categories", "homepage-pages"] },
);

export async function getLandingPageForCheckout(slug: string) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const site = await currentSite();
  let q = db
    .from("lp_landing_pages")
    .select("id, title, slug, price, price_discount, is_free, purchase_link, purchase_type, thumbnail_url, zip_url, story_pdf_url, story_epub_url, long_description, category_id, sold_count, rating, view_count, like_count, available_at, published, user_id, preview_label, cta_label, cta_note, cta_action, event_title, event_start, event_end, event_location, event_description, bundle_product_ids, bundle_note, related_product_ids, thumbnail_landscape_url, thumbnail_extra_urls")
    .eq("slug", slug);
  if (site.business_id) q = q.eq("business_id", site.business_id);
  const { data, error } = await q.single();

  if (error || !data) return null;
  // Hidden pages can't be checked out by the public; the owner still can (preview).
  if (data.published === false && data.user_id !== user?.id) return null;
  return data as LandingPageCheckout;
}

/**
 * Best-effort atomic +1 to a product's public view counter. Called once per
 * session from the preview / checkout pages (see ViewTracker). Uses the anon
 * client + a SECURITY DEFINER RPC so it works for logged-out visitors and never
 * throws into the render.
 */
export async function incrementLandingView(slug: string) {
  const clean = slug.trim();
  if (!clean) return;
  try {
    const db = createAnonClient();
    await db.rpc("lp_increment_view", { p_slug: clean });
  } catch {
    /* view counting is best-effort — never surface an error to the visitor */
  }
}

export type RelatedProduct = {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  price_discount: number | null;
  is_free: boolean;
  thumbnail_url: string | null;
  thumbnail_landscape_url?: string | null;
};

/**
 * Other published products in the same PARENT category as the given product
 * (aggregating the parent + its sub-categories), excluding the product itself.
 * Also returns the parent category so the caller can link to its page.
 */
export async function getRelatedProducts(
  currentId: string,
  categoryId: string | null,
  limit = 5,
): Promise<{ items: RelatedProduct[]; parent: LandingPageCategory | null }> {
  if (!categoryId) return { items: [], parent: null };

  const cats = await getCategories();
  const current = cats.find((c) => c.id === categoryId);
  if (!current) return { items: [], parent: null };

  // Resolve to the top-level parent: a sub-category rolls up to its parent; a
  // top-level category is its own parent.
  const parent = current.parent_id
    ? cats.find((c) => c.id === current.parent_id) ?? current
    : current;
  const categoryIds = [parent.id, ...cats.filter((c) => c.parent_id === parent.id).map((c) => c.id)];

  const db = createAnonClient();
  const site = await currentSite();
  let related = db
    .from("lp_landing_pages")
    .select("id, title, slug, price, price_discount, is_free, thumbnail_url, thumbnail_landscape_url")
    .eq("published", true)
    .in("category_id", categoryIds)
    .neq("id", currentId);
  if (site.business_id) related = related.eq("business_id", site.business_id);
  const { data, error } = await related
    .order("featured", { ascending: false })
    .order("sold_count", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) return { items: [], parent };
  return { items: (data ?? []) as RelatedProduct[], parent };
}

/**
 * Fetch a set of products by id, in the same order the ids are given. Only
 * published products come back (unpublished/deleted ids are silently dropped).
 * Used for the manually-curated "related products" shown at the end of a
 * product's preview.
 */
export async function getProductsByIds(ids: string[]): Promise<RelatedProduct[]> {
  const clean = (ids ?? []).filter((id) => typeof id === "string" && id.length > 0);
  if (clean.length === 0) return [];

  const db = createAnonClient();
  const site = await currentSite();
  let query = db
    .from("lp_landing_pages")
    .select("id, title, slug, price, price_discount, is_free, thumbnail_url")
    .eq("published", true)
    .in("id", clean);
  if (site.business_id) query = query.eq("business_id", site.business_id);
  const { data, error } = await query;

  if (error || !data) return [];
  // Preserve the seller's chosen order (the DB doesn't guarantee it).
  const byId = new Map((data as RelatedProduct[]).map((p) => [p.id, p]));
  return clean.map((id) => byId.get(id)).filter((p): p is RelatedProduct => !!p);
}

export async function updateLandingPagePricing(
  id: string,
  opts: {
    price?: number | null;
    price_discount?: number | null;
    is_free?: boolean;
    purchase_link?: string | null;
    purchase_type?: "external" | "internal";
    featured?: boolean;
    thumbnail_url?: string | null;
    thumbnail_landscape_url?: string | null;
    thumbnail_extra_urls?: string[] | null;
    zip_url?: string | null;
    story_pdf_url?: string | null;
    story_pdf_url_dark?: string | null;
    story_epub_url?: string | null;
    rating?: number | null;
    category_id?: string | null;
    long_description?: string | null;
    preview_label?: string | null;
    cta_label?: string | null;
    cta_note?: string | null;
    cta_action?: "checkout" | "link" | "calendar" | null;
    event_title?: string | null;
    event_start?: string | null;
    event_end?: string | null;
    event_location?: string | null;
    event_description?: string | null;
    related_product_ids?: string[] | null;
    next_product_id?: string | null;
    bundle_product_ids?: string[] | null;
    bundle_note?: string | null;
    available_at?: string | null;
  }
) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Descriptions are publisher-authored rich text — sanitize before storing.
  const payload = { ...opts };
  if ("long_description" in payload) {
    const clean = sanitizeRichText(payload.long_description);
    payload.long_description = clean || null;
  }

  const { error } = await db
    .from("lp_landing_pages")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
  updateTag("homepage-pages");
  revalidatePath("/panel");
  revalidatePath(`/panel/product/${id}/edit`);
  revalidatePath("/");
}

/** Pin/unpin a product so it sorts to the front of public listings. */
export async function setLandingPageFeatured(id: string, featured: boolean) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await db
    .from("lp_landing_pages")
    .update({ featured })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
  updateTag("homepage-pages");
  revalidatePath("/panel");
  revalidatePath("/");
}

/**
 * Show/hide a product. Hidden pages drop out of public listings and 404 for
 * non-owners on /preview/[slug] and /checkout/[slug] (the owner can still preview).
 */
export async function setLandingPagePublished(id: string, published: boolean) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await db
    .from("lp_landing_pages")
    .update({ published })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("slug")
    .single();

  if (error) throw error;
  updateTag("homepage-pages");
  revalidatePath("/panel");
  revalidatePath("/");
  if (data?.slug) {
    revalidatePath(`/preview/${data.slug}`);
    revalidatePath(`/checkout/${data.slug}`);
  }
}

export async function deleteLandingPage(id: string) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await db
    .from("lp_landing_pages")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
  updateTag("homepage-pages");
  revalidatePath("/panel");
}
