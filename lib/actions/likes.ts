"use server";

import { createClient } from "@/lib/supabase/server";

/** Whether the current user has liked this product (false when logged out). */
export async function getMyLike(pageId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("lp_product_likes")
    .select("id")
    .eq("landing_page_id", pageId)
    .eq("user_id", user.id)
    .maybeSingle();

  return !!data;
}

/**
 * Toggle the current user's like on a product. Login-gated: returns
 * { ok: false } when not signed in. The DB trigger keeps like_count in sync, so
 * the fresh count is read back afterwards.
 */
export async function toggleLike(
  pageId: string,
): Promise<{ ok: boolean; liked: boolean; count: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const readCount = async () => {
    const { data } = await supabase
      .from("lp_landing_pages")
      .select("like_count")
      .eq("id", pageId)
      .single();
    return data?.like_count ?? 0;
  };

  if (!user) return { ok: false, liked: false, count: await readCount() };

  const { data: existing } = await supabase
    .from("lp_product_likes")
    .select("id")
    .eq("landing_page_id", pageId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("lp_product_likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("lp_product_likes").insert({ landing_page_id: pageId, user_id: user.id });
  }

  return { ok: true, liked: !existing, count: await readCount() };
}

export type FavoriteProduct = {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  price_discount: number | null;
  is_free: boolean;
  thumbnail_url: string | null;
  liked_at: string;
};

/**
 * Products the current user has liked (their favorites), newest first. Only
 * still-public products are returned — RLS hides unpublished pages, so a joined
 * page that's no longer visible comes back null and is filtered out.
 */
export async function getMyFavorites(): Promise<FavoriteProduct[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lp_product_likes")
    .select(
      "created_at, landing_page:lp_landing_pages(id, title, slug, price, price_discount, is_free, thumbnail_url, published)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];

  type Row = {
    created_at: string;
    landing_page: {
      id: string;
      title: string;
      slug: string;
      price: number | null;
      price_discount: number | null;
      is_free: boolean;
      thumbnail_url: string | null;
      published: boolean | null;
    } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.landing_page && r.landing_page.published !== false)
    .map((r) => ({
      id: r.landing_page!.id,
      title: r.landing_page!.title,
      slug: r.landing_page!.slug,
      price: r.landing_page!.price,
      price_discount: r.landing_page!.price_discount,
      is_free: r.landing_page!.is_free,
      thumbnail_url: r.landing_page!.thumbnail_url,
      liked_at: r.created_at,
    }));
}
