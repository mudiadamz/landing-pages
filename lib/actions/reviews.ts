"use server";

import { revalidatePath, unstable_cache } from "next/cache";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function createAnonClient() {
  return createSupabaseJS(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export type UserReview = {
  id: string;
  landing_page_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A purchase-gated review, safe to show publicly. Intentionally carries NO
 * reviewer identity — lp_profiles RLS keeps names private, and the trust
 * signal is the verified-buyer badge, not the name.
 */
export type PublicReview = {
  id: string;
  rating: number;
  review_text: string;
  created_at: string;
};

const getCachedPublicReviews = unstable_cache(
  async (landingPageId: string, limit: number): Promise<PublicReview[]> => {
    const supabase = createAnonClient();
    let query = supabase
      .from("lp_reviews")
      .select("id, rating, review_text, created_at")
      .not("review_text", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (landingPageId) query = query.eq("landing_page_id", landingPageId);

    const { data, error } = await query;
    if (error) return [];
    return ((data ?? []) as PublicReview[]).filter(
      (r) => typeof r.review_text === "string" && r.review_text.trim().length > 0,
    );
  },
  ["public-reviews"],
  { revalidate: 60 },
);

/**
 * Public, verified-buyer reviews with non-empty text. Pass a landing page id to
 * scope to one product (checkout), or omit for a site-wide feed (homepage).
 */
export async function getPublicReviews(
  landingPageId?: string,
  limit = 12,
): Promise<PublicReview[]> {
  return getCachedPublicReviews(landingPageId ?? "", limit);
}

const getCachedReviewCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("lp_reviews")
      .select("landing_page_id");
    if (error) return {};
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { landing_page_id: string }[]) {
      counts[row.landing_page_id] = (counts[row.landing_page_id] ?? 0) + 1;
    }
    return counts;
  },
  ["review-counts"],
  { revalidate: 60 },
);

/** Total review count per landing page id (the rating denominator). */
export async function getReviewCounts(): Promise<Record<string, number>> {
  return getCachedReviewCounts();
}

/** Total review count for a single landing page. */
export async function getReviewCount(landingPageId: string): Promise<number> {
  const counts = await getCachedReviewCounts();
  return counts[landingPageId] ?? 0;
}

export async function getReviewsByUser(): Promise<UserReview[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lp_reviews")
    .select("id, landing_page_id, rating, review_text, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as UserReview[];
}

export async function submitReview(
  landingPageId: string,
  rating: number,
  reviewText: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  if (rating < 1 || rating > 5) return { error: "Rating harus 1-5" };

  const { data: purchase } = await supabase
    .from("lp_purchases")
    .select("id")
    .eq("user_id", user.id)
    .eq("landing_page_id", landingPageId)
    .single();

  if (!purchase) return { error: "Kamu belum membeli produk ini" };

  const { data: existing } = await supabase
    .from("lp_reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("landing_page_id", landingPageId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("lp_reviews")
      .update({
        rating,
        review_text: reviewText.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) return { error: "Gagal mengupdate review" };
  } else {
    const { error } = await supabase.from("lp_reviews").insert({
      user_id: user.id,
      landing_page_id: landingPageId,
      rating,
      review_text: reviewText.trim() || null,
    });

    if (error) return { error: "Gagal menyimpan review" };
  }

  revalidatePath("/panel");
  revalidatePath("/");
  return { success: true };
}
