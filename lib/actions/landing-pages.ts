"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidSlug } from "@/lib/slug";

export type LandingPageRow = {
  id: string;
  title: string;
  slug: string;
  html_content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
};

export async function getLandingPagesForUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("landing_pages")
    .select("id, title, slug, created_at, updated_at")
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
  revalidatePath("/panel");
  revalidatePath(`/panel/landing-pages/${id}/edit`);
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
