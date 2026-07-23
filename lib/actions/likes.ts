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
