"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UserReview = {
  id: string;
  landing_page_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
};

export async function getReviewsByUser(): Promise<UserReview[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("reviews")
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
    .from("purchases")
    .select("id")
    .eq("user_id", user.id)
    .eq("landing_page_id", landingPageId)
    .single();

  if (!purchase) return { error: "Kamu belum membeli produk ini" };

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("landing_page_id", landingPageId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("reviews")
      .update({
        rating,
        review_text: reviewText.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) return { error: "Gagal mengupdate review" };
  } else {
    const { error } = await supabase.from("reviews").insert({
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
