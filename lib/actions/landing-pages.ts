"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveVersion } from "./versions";
import { isValidSlug } from "@/lib/slug";

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
};

export type LandingPagePublic = {
  id: string;
  title: string;
  slug: string;
  html_content: string;
  price?: number | null;
  price_discount?: number | null;
  is_free?: boolean;
  purchase_link?: string | null;
  purchase_type?: "external" | "internal";
  thumbnail_url?: string | null;
  sold_count?: number;
  rating?: number | null;
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
};

export async function getLandingPagesForUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("landing_pages")
    .select("id, title, slug, created_at, updated_at, price, price_discount, is_free, purchase_link, purchase_type, featured, zip_url")
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
    .from("landing_pages")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data as LandingPageRow;
}

export async function getLandingPageBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landing_pages")
    .select("id, title, slug, html_content")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createLandingPage(
  title: string,
  slug: string,
  html_content: string
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
    .from("landing_pages")
    .insert({ title, slug: normalizedSlug, html_content, user_id: user.id })
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
    .from("landing_pages")
    .update({ html_content })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;

  await saveVersion(id, html_content);

  revalidatePath("/panel");
  revalidatePath(`/panel/landing-pages/${id}/edit`);
}

export async function getLandingPagesForHomepage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landing_pages")
    .select("id, title, slug, html_content, price, price_discount, is_free, purchase_link, purchase_type, thumbnail_url, sold_count, rating")
    .order("updated_at", { ascending: false })
    .limit(24);

  if (error) return [];
  return (data ?? []) as LandingPagePublic[];
}

export async function getLandingPageForCheckout(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landing_pages")
    .select("id, title, slug, price, price_discount, is_free, purchase_link, purchase_type, thumbnail_url, zip_url")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
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
    rating?: number | null;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("landing_pages")
    .update(opts)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
  revalidatePath("/panel");
  revalidatePath(`/panel/landing-pages/${id}/edit`);
  revalidatePath("/");
}

export async function deleteLandingPage(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("landing_pages")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
  revalidatePath("/panel");
}
