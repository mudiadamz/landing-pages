"use server";

import { revalidatePath, updateTag, unstable_cache } from "next/cache";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isValidSlug } from "@/lib/slug";
import { sanitizeRichText } from "@/lib/html-sanitize";

export type PreviewType = "html" | "pdf" | "link";

function createAnonClient() {
  return createSupabaseJS(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

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
  sold_count?: number;
  rating?: number | null;
  category?: LandingPageCategory | null;
  long_description?: string | null;
  /** Pinned products sort to the front of listings. */
  featured?: boolean;
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
  zip_url: string | null;
  story_pdf_url?: string | null;
  long_description?: string | null;
  sold_count?: number;
  rating?: number | null;
  cta_label?: string | null;
  cta_note?: string | null;
  /** When the sticky CTA reveals on scroll: "start"|"middle"(default)|"near"|"end". */
  cta_reveal?: "start" | "middle" | "near" | "end" | null;
  /** Buy-button action: "checkout" (default) | "link" | "calendar". */
  cta_action?: "checkout" | "link" | "calendar" | null;
  event_title?: string | null;
  /** Floating local datetime string, e.g. "2026-08-01T14:00". */
  event_start?: string | null;
  event_end?: string | null;
  event_location?: string | null;
  event_description?: string | null;
};

export async function getLandingPagesForUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lp_landing_pages")
    .select("id, title, slug, created_at, updated_at, price, price_discount, is_free, purchase_link, purchase_type, featured, published, category_id, zip_url")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getLandingPageById(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("lp_landing_pages")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data as LandingPageRow;
}

export async function getLandingPageBySlug(slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("lp_landing_pages")
    .select("id, title, slug, html_content, preview_type, preview_url, preview_url_dark, published, user_id")
    .eq("slug", slug)
    .single();

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("lp_landing_pages")
    .insert({
      title,
      slug: normalizedSlug,
      html_content,
      user_id: user.id,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
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
 * source controls what /lp/[slug] embeds — inline HTML (default), an uploaded
 * PDF, or an external link.
 */
export async function updateLandingPageSettings(
  id: string,
  opts: {
    title?: string;
    preview_type?: PreviewType;
    preview_url?: string | null;
    preview_url_dark?: string | null;
  },
  slug?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  // A PDF preview needs at least one file (light or dark); a link needs its URL.
  if (opts.preview_type === "pdf" && opts.preview_url !== undefined) {
    if (!update.preview_url && !update.preview_url_dark) {
      throw new Error("Preview PDF membutuhkan minimal satu file (terang atau gelap).");
    }
  }
  if (opts.preview_type === "link" && opts.preview_url !== undefined && !update.preview_url) {
    throw new Error("Preview link membutuhkan URL.");
  }

  const { error } = await supabase
    .from("lp_landing_pages")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;

  updateTag("homepage-pages");
  revalidatePath("/panel");
  revalidatePath(`/panel/product/${id}/edit`);
  if (slug) {
    revalidatePath(`/lp/${slug}`);
    revalidatePath(`/checkout/${slug}`);
  }
  revalidatePath("/");
}

export const getCategories = unstable_cache(
  async (): Promise<LandingPageCategory[]> => {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("lp_landing_page_categories")
      .select("id, name, slug, icon, parent_id")
      .order("sort_order", { ascending: true });

    if (error) return [];
    return (data ?? []) as LandingPageCategory[];
  },
  ["categories"],
  { revalidate: 60, tags: ["categories"] },
);

export type HomepageSort = "newest" | "popular";

export async function getLandingPagesForHomepage(
  categorySlug?: string | null,
  sort: HomepageSort = "newest",
) {
  const slug = categorySlug?.trim() || "";
  return getCachedHomepagePages(slug, sort);
}

const getCachedHomepagePages = unstable_cache(
  async (slug: string, sort: HomepageSort): Promise<LandingPagePublic[]> => {
    const supabase = createAnonClient();

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

    let query = supabase
      .from("lp_landing_pages")
      .select(
        "id, title, slug, price, price_discount, is_free, purchase_link, purchase_type, thumbnail_url, sold_count, rating, long_description, featured, landing_page_categories:lp_landing_page_categories(id, name, slug, icon, parent_id)",
      )
      // Pinned (featured) products always first, then the chosen sort:
      // "popular" = most sold, "newest" = most recently created.
      .eq("published", true)
      .order("featured", { ascending: false });

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("lp_landing_pages")
    .select("id, title, slug, price, price_discount, is_free, purchase_link, purchase_type, thumbnail_url, zip_url, story_pdf_url, long_description, sold_count, rating, published, user_id, cta_label, cta_note, cta_reveal, cta_action, event_title, event_start, event_end, event_location, event_description")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  // Hidden pages can't be checked out by the public; the owner still can (preview).
  if (data.published === false && data.user_id !== user?.id) return null;
  return data as LandingPageCheckout;
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
    zip_url?: string | null;
    story_pdf_url?: string | null;
    story_pdf_url_dark?: string | null;
    rating?: number | null;
    category_id?: string | null;
    long_description?: string | null;
    cta_label?: string | null;
    cta_note?: string | null;
    cta_reveal?: "start" | "middle" | "near" | "end" | null;
    cta_action?: "checkout" | "link" | "calendar" | null;
    event_title?: string | null;
    event_start?: string | null;
    event_end?: string | null;
    event_location?: string | null;
    event_description?: string | null;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Descriptions are publisher-authored rich text — sanitize before storing.
  const payload = { ...opts };
  if ("long_description" in payload) {
    const clean = sanitizeRichText(payload.long_description);
    payload.long_description = clean || null;
  }

  const { error } = await supabase
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
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
 * non-owners on /lp/[slug] and /checkout/[slug] (the owner can still preview).
 */
export async function setLandingPagePublished(id: string, published: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
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
    revalidatePath(`/lp/${data.slug}`);
    revalidatePath(`/checkout/${data.slug}`);
  }
}

export async function deleteLandingPage(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("lp_landing_pages")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
  updateTag("homepage-pages");
  revalidatePath("/panel");
}
